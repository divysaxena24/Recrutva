import { db } from "@/db";
import {
  schedules,
  scheduleLogs,
  applicants,
  candidateRounds,
  pipelineRounds,
} from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { generateICS } from "@/lib/ics";
import { sendEmail, getAppUrl } from "@/lib/email";

export type ScheduleStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "RESCHEDULED"
  | "CANCELLED"
  | "COMPLETED"
  | "MISSED";

export interface CreateScheduleInput {
  candidateId: number;
  candidateRoundId?: number;
  recruiterUserId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  timezone?: string;
  meetingProvider?: string;
  meetingUrl?: string;
}

export interface RescheduleInput {
  scheduleId: number;
  newScheduledAt: Date;
  recruiterUserId: string;
  reason?: string;
  timezone?: string;
}

export interface CancelScheduleInput {
  scheduleId: number;
  recruiterUserId: string;
  reason?: string;
}

export interface ConfirmScheduleInput {
  scheduleId: number;
  candidateClerkUserId: string;
}

/**
 * Server-side Conflict Detection Engine.
 * Verifies that neither the recruiter nor the candidate has an overlapping active interview.
 */
export async function checkScheduleConflict(params: {
  recruiterUserId: string;
  candidateId: number;
  scheduledAt: Date;
  durationMinutes: number;
  excludeScheduleId?: number;
}): Promise<{ conflict: boolean; reason?: string }> {
  const {
    recruiterUserId,
    candidateId,
    scheduledAt,
    durationMinutes,
    excludeScheduleId,
  } = params;

  const proposedStart = scheduledAt.getTime();
  const proposedEnd = proposedStart + durationMinutes * 60 * 1000;

  const activeStatuses: ScheduleStatus[] = ["SCHEDULED", "CONFIRMED", "RESCHEDULED"];

  // Fetch recruiter's active schedules
  const recruiterSchedules = await db
    .select({
      id: schedules.id,
      scheduledAt: schedules.scheduledAt,
      durationMinutes: schedules.durationMinutes,
      candidateId: schedules.candidateId,
    })
    .from(schedules)
    .where(
      and(
        eq(schedules.recruiterUserId, recruiterUserId),
        inArray(schedules.status, activeStatuses)
      )
    );

  for (const s of recruiterSchedules) {
    if (excludeScheduleId && s.id === excludeScheduleId) continue;
    const start = new Date(s.scheduledAt).getTime();
    const end = start + s.durationMinutes * 60 * 1000;

    if (proposedStart < end && proposedEnd > start) {
      if (s.candidateId === candidateId) {
        return {
          conflict: true,
          reason: "This candidate already has an active interview scheduled during this time window.",
        };
      }
      return {
        conflict: true,
        reason: "You (Recruiter) already have another interview scheduled during this time window.",
      };
    }
  }

  // Fetch candidate's active schedules across all recruiters/jobs
  const candidateSchedules = await db
    .select({
      id: schedules.id,
      scheduledAt: schedules.scheduledAt,
      durationMinutes: schedules.durationMinutes,
    })
    .from(schedules)
    .where(
      and(
        eq(schedules.candidateId, candidateId),
        inArray(schedules.status, activeStatuses)
      )
    );

  for (const s of candidateSchedules) {
    if (excludeScheduleId && s.id === excludeScheduleId) continue;
    const start = new Date(s.scheduledAt).getTime();
    const end = start + s.durationMinutes * 60 * 1000;

    if (proposedStart < end && proposedEnd > start) {
      return {
        conflict: true,
        reason: "The candidate has another conflicting interview session at this time.",
      };
    }
  }

  return { conflict: false };
}

/**
 * Creates a production-grade interview schedule tied to candidate and candidateRound.
 */
export async function createSchedule(input: CreateScheduleInput) {
  const {
    candidateId,
    candidateRoundId,
    recruiterUserId,
    scheduledAt,
    durationMinutes = 45,
    timezone = "Asia/Kolkata",
    meetingProvider = "INTERNAL",
    meetingUrl,
  } = input;

  // 1. Verify candidate ownership by recruiter
  const [candidate] = await db
    .select({
      id: applicants.id,
      name: applicants.name,
      email: applicants.email,
      jobTitle: applicants.jobTitle,
      userId: applicants.userId,
      targetJobId: applicants.targetJobId,
    })
    .from(applicants)
    .where(and(eq(applicants.id, candidateId), eq(applicants.userId, recruiterUserId)))
    .limit(1);

  if (!candidate) {
    return { success: false, error: "Candidate not found or access denied." };
  }

  // 2. Validate datetime is future (with 15 min buffer)
  if (scheduledAt.getTime() < Date.now() - 15 * 60 * 1000) {
    return { success: false, error: "Scheduled time must be in the future." };
  }

  // 3. Server-side conflict detection
  const conflictCheck = await checkScheduleConflict({
    recruiterUserId,
    candidateId,
    scheduledAt,
    durationMinutes,
  });

  if (conflictCheck.conflict) {
    return { success: false, error: conflictCheck.reason || "Schedule conflict detected." };
  }

  // Determine effective meeting URL
  const defaultMeetingUrl = `${getAppUrl()}/interview/${candidateId}`;
  const finalMeetingUrl = meetingUrl || defaultMeetingUrl;

  // 4. DB Inserts (Sequential for neon-http driver compatibility)
  const [inserted] = await db
    .insert(schedules)
    .values({
      candidateId,
      candidateRoundId: candidateRoundId || null,
      recruiterUserId,
      scheduledAt,
      durationMinutes,
      timezone,
      status: "SCHEDULED",
      meetingProvider,
      meetingUrl: finalMeetingUrl,
    })
    .returning();

  // Log creation
  await db.insert(scheduleLogs).values({
    scheduleId: inserted.id,
    action: "CREATED",
    newScheduledAt: scheduledAt,
    newStatus: "SCHEDULED",
    changedByUserId: recruiterUserId,
    reason: "Initial schedule creation",
  });

  // Backward compatibility: Sync applicants.scheduledAt
  await db
    .update(applicants)
    .set({
      scheduledAt,
      status: "Scheduled",
    })
    .where(eq(applicants.id, candidateId));

  const newSchedule = inserted;

  // 5. Send Email with ICS attachment
  try {
    const icsContent = generateICS({
      title: `Recrutva Technical Interview - ${candidate.jobTitle || "Job Opening"}`,
      description: `Your interview with Recrutva for position ${candidate.jobTitle || "Role"}.\nMeeting URL: ${finalMeetingUrl}`,
      location: finalMeetingUrl,
      startTime: scheduledAt,
      durationMinutes,
      organizerName: "Recrutva Hiring Team",
    });

    const formattedTime = scheduledAt.toLocaleString("en-US", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "short",
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; background: #0b0f19; color: #e2e8f0; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background: #131b2e; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
          <h2 style="color: #6366f1;">Interview Scheduled</h2>
          <p>Hello <strong>${candidate.name}</strong>,</p>
          <p>Your technical interview for <strong>${candidate.jobTitle || "the role"}</strong> has been scheduled.</p>
          <div style="background: #1e293b; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${formattedTime} (${timezone})</p>
            <p style="margin: 4px 0;"><strong>Duration:</strong> ${durationMinutes} minutes</p>
            <p style="margin: 4px 0;"><strong>Meeting Link:</strong> <a href="${finalMeetingUrl}" style="color: #818cf8;">${finalMeetingUrl}</a></p>
          </div>
          <p>A calendar invitation (.ics) is attached to this email so you can add it to your calendar.</p>
          <a href="${finalMeetingUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">Start Interview</a>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: candidate.email,
      subject: `Interview Scheduled: ${candidate.jobTitle || "Recrutva Application"}`,
      html: emailHtml,
      attachments: [
        {
          filename: "interview-invite.ics",
          content: icsContent,
          contentType: "text/calendar; method=REQUEST",
        },
      ],
    });
  } catch (emailErr) {
    console.error("[Scheduling] Error sending schedule email:", emailErr);
  }

  return { success: true, schedule: newSchedule };
}

/**
 * Reschedules an interview without overwriting history.
 */
export async function rescheduleSchedule(input: RescheduleInput) {
  const { scheduleId, newScheduledAt, recruiterUserId, reason, timezone } = input;

  const [existing] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.id, scheduleId), eq(schedules.recruiterUserId, recruiterUserId)))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Schedule not found or unauthorized." };
  }

  if (newScheduledAt.getTime() < Date.now() - 15 * 60 * 1000) {
    return { success: false, error: "New date must be in the future." };
  }

  // Conflict check
  const conflict = await checkScheduleConflict({
    recruiterUserId,
    candidateId: existing.candidateId,
    scheduledAt: newScheduledAt,
    durationMinutes: existing.durationMinutes,
    excludeScheduleId: scheduleId,
  });

  if (conflict.conflict) {
    return { success: false, error: conflict.reason || "Conflicting schedule time." };
  }

  const effectiveTimezone = timezone || existing.timezone;

  // Audit log
  await db.insert(scheduleLogs).values({
    scheduleId,
    action: "RESCHEDULED",
    previousScheduledAt: existing.scheduledAt,
    newScheduledAt,
    previousStatus: existing.status,
    newStatus: "RESCHEDULED",
    changedByUserId: recruiterUserId,
    reason: reason || "Recruiter updated schedule time",
  });

  // Update schedule
  await db
    .update(schedules)
    .set({
      scheduledAt: newScheduledAt,
      timezone: effectiveTimezone,
      status: "RESCHEDULED",
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, scheduleId));

  // Sync legacy applicants.scheduledAt
  await db
    .update(applicants)
    .set({ scheduledAt: newScheduledAt })
    .where(eq(applicants.id, existing.candidateId));

  // Fetch candidate details for notification
  const [candidate] = await db
    .select()
    .from(applicants)
    .where(eq(applicants.id, existing.candidateId))
    .limit(1);

  if (candidate) {
    try {
      const icsContent = generateICS({
        title: `RESCHEDULED: Recrutva Interview - ${candidate.jobTitle || "Position"}`,
        description: `Your interview has been rescheduled to ${newScheduledAt.toISOString()}.\nReason: ${reason || "Updated by recruiter"}`,
        location: existing.meetingUrl || `${getAppUrl()}/interview/${candidate.id}`,
        startTime: newScheduledAt,
        durationMinutes: existing.durationMinutes,
      });

      const formattedTime = newScheduledAt.toLocaleString("en-US", {
        timeZone: effectiveTimezone,
        dateStyle: "full",
        timeStyle: "short",
      });

      const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background: #0b0f19; color: #e2e8f0; padding: 24px;">
          <div style="max-width: 600px; margin: 0 auto; background: #131b2e; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
            <h2 style="color: #fbbf24;">Interview Rescheduled</h2>
            <p>Hello <strong>${candidate.name}</strong>,</p>
            <p>Your interview for <strong>${candidate.jobTitle || "the position"}</strong> has been updated to a new time.</p>
            <div style="background: #1e293b; padding: 16px; border-radius: 12px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>New Time:</strong> ${formattedTime} (${effectiveTimezone})</p>
              ${reason ? `<p style="margin: 4px 0;"><strong>Note:</strong> ${reason}</p>` : ""}
            </div>
            <p>Updated calendar invite (.ics) attached.</p>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: candidate.email,
        subject: `Rescheduled: Interview for ${candidate.jobTitle || "Recrutva Position"}`,
        html,
        attachments: [
          {
            filename: "rescheduled-interview.ics",
            content: icsContent,
            contentType: "text/calendar; method=REQUEST",
          },
        ],
      });
    } catch (err) {
      console.error("[Scheduling] Error sending reschedule notification:", err);
    }
  }

  return { success: true };
}

/**
 * Cancels a schedule cleanly without deleting records.
 */
export async function cancelSchedule(input: CancelScheduleInput) {
  const { scheduleId, recruiterUserId, reason } = input;

  const [existing] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.id, scheduleId), eq(schedules.recruiterUserId, recruiterUserId)))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Schedule not found or unauthorized." };
  }

  await db.insert(scheduleLogs).values({
    scheduleId,
    action: "CANCELLED",
    previousScheduledAt: existing.scheduledAt,
    newScheduledAt: existing.scheduledAt,
    previousStatus: existing.status,
    newStatus: "CANCELLED",
    changedByUserId: recruiterUserId,
    reason: reason || "Recruiter cancelled interview",
  });

  await db
    .update(schedules)
    .set({
      status: "CANCELLED",
      cancellationReason: reason || "Cancelled by recruiter",
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, scheduleId));

  // Notify candidate
  const [candidate] = await db
    .select()
    .from(applicants)
    .where(eq(applicants.id, existing.candidateId))
    .limit(1);

  if (candidate) {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background: #0b0f19; color: #e2e8f0; padding: 24px;">
          <div style="max-width: 600px; margin: 0 auto; background: #131b2e; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
            <h2 style="color: #f87171;">Interview Cancelled</h2>
            <p>Hello <strong>${candidate.name}</strong>,</p>
            <p>Your scheduled interview for <strong>${candidate.jobTitle || "the position"}</strong> has been cancelled.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: candidate.email,
        subject: `Cancelled: Interview for ${candidate.jobTitle || "Recrutva Position"}`,
        html,
      });
    } catch (err) {
      console.error("[Scheduling] Error sending cancellation notification:", err);
    }
  }

  return { success: true };
}

/**
 * Candidate confirms their upcoming interview schedule.
 */
export async function confirmSchedule(input: ConfirmScheduleInput) {
  const { scheduleId, candidateClerkUserId } = input;

  const [sched] = await db
    .select({
      id: schedules.id,
      candidateId: schedules.candidateId,
      status: schedules.status,
    })
    .from(schedules)
    .where(eq(schedules.id, scheduleId))
    .limit(1);

  if (!sched) {
    return { success: false, error: "Schedule not found." };
  }

  // Check candidate identity
  const [candidate] = await db
    .select({ id: applicants.id, clerkUserId: applicants.clerkUserId })
    .from(applicants)
    .where(and(eq(applicants.id, sched.candidateId), eq(applicants.clerkUserId, candidateClerkUserId)))
    .limit(1);

  if (!candidate) {
    return { success: false, error: "Unauthorized access to schedule." };
  }

  await db.insert(scheduleLogs).values({
    scheduleId,
    action: "CONFIRMED",
    previousStatus: sched.status,
    newStatus: "CONFIRMED",
    changedByUserId: candidateClerkUserId,
    reason: "Confirmed by candidate",
  });

  await db
    .update(schedules)
    .set({
      status: "CONFIRMED",
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, scheduleId));

  return { success: true };
}

/**
 * Server-side Access Window Enforcement.
 * Checks whether the current timestamp is within [scheduledAt - windowBefore, scheduledAt + duration + windowAfter].
 */
export async function validateAccessWindow(candidateId: number) {
  const now = Date.now();

  // Fetch active schedule for this candidate
  const activeSchedules = await db
    .select({
      id: schedules.id,
      scheduledAt: schedules.scheduledAt,
      durationMinutes: schedules.durationMinutes,
      status: schedules.status,
      candidateRoundId: schedules.candidateRoundId,
    })
    .from(schedules)
    .where(
      and(
        eq(schedules.candidateId, candidateId),
        inArray(schedules.status, ["SCHEDULED", "CONFIRMED", "RESCHEDULED"])
      )
    )
    .orderBy(desc(schedules.scheduledAt));

  if (activeSchedules.length === 0) {
    // If no active schedule exists, allow entry (unscheduled / async mode fallback)
    return { allowed: true, isScheduled: false };
  }

  const active = activeSchedules[0];

  // Read configuration from pipelineRound if attached
  let windowBeforeMs = 10 * 60 * 1000; // default 10 mins before
  let windowAfterMs = 15 * 60 * 1000;  // default 15 mins after duration

  if (active.candidateRoundId) {
    const [cr] = await db
      .select({ roundId: candidateRounds.roundId })
      .from(candidateRounds)
      .where(eq(candidateRounds.id, active.candidateRoundId))
      .limit(1);

    if (cr) {
      const [pr] = await db
        .select({ configuration: pipelineRounds.configuration })
        .from(pipelineRounds)
        .where(eq(pipelineRounds.id, cr.roundId))
        .limit(1);

      if (pr?.configuration && typeof pr.configuration === "object") {
        const config = pr.configuration as Record<string, unknown>;
        if (typeof config.accessWindowBeforeMinutes === "number") {
          windowBeforeMs = config.accessWindowBeforeMinutes * 60 * 1000;
        }
        if (typeof config.accessWindowAfterMinutes === "number") {
          windowAfterMs = config.accessWindowAfterMinutes * 60 * 1000;
        }
      }
    }
  }

  const startMs = new Date(active.scheduledAt).getTime();
  const durationMs = active.durationMinutes * 60 * 1000;
  const windowOpen = startMs - windowBeforeMs;
  const windowClose = startMs + durationMs + windowAfterMs;

  if (now < windowOpen) {
    return {
      allowed: false,
      reason: "TOO_EARLY",
      isScheduled: true,
      windowOpenTime: new Date(windowOpen),
      scheduledAt: new Date(startMs),
    };
  }

  if (now > windowClose) {
    return {
      allowed: false,
      reason: "EXPIRED",
      isScheduled: true,
      windowCloseTime: new Date(windowClose),
      scheduledAt: new Date(startMs),
    };
  }

  return {
    allowed: true,
    isScheduled: true,
    schedule: active,
  };
}
