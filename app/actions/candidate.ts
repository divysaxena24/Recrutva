"use server";

import { db } from "@/db";
import { applicants, jobs, pipelines, pipelineRounds, candidateRounds } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq, and, inArray, asc, desc } from "drizzle-orm";
import { sendInterviewInviteEmail } from "@/lib/interview-email";
import { CreateCandidateSchema, UpdateCandidateSchema } from "@/lib/schemas/actions";

export async function createCandidate(data: {
  name: string;
  email: string;
  phone: string;
  resumeText: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumePublicId?: string;
  jobTitle?: string;
  targetJobId?: number;
  scheduledAt?: string;
}) {
  // Validate all input server-side (server actions are client-callable)
  const validation = CreateCandidateSchema.safeParse(data);
  if (!validation.success) {
    const message = validation.error.issues[0]?.message ?? "Invalid input";
    return { success: false, error: message };
  }
  data = validation.data as typeof data;

  const { userId: currentAuthUserId } = await auth();

  // The candidate's own Clerk ID (if logged in as an applicant)
  const candidateClerkUserId = currentAuthUserId;

  let recruiterUserId: string | null = null;

  // If applying for a job, assign ownership to the posting recruiter who created the job
  if (data.targetJobId) {
    const jobData = await db
      .select({ userId: jobs.userId })
      .from(jobs)
      .where(eq(jobs.id, data.targetJobId))
      .limit(1);
    if (jobData[0]) {
      recruiterUserId = jobData[0].userId;
    }
  }

  // Fallback to current authenticated user if manually created without a target job
  if (!recruiterUserId) {
    recruiterUserId = currentAuthUserId;
  }

  if (!recruiterUserId) {
    throw new Error("Unauthorized or Job not found");
  }

  try {
    // 1. Prevent Duplicate Applications: Check if this email has already applied for this specific job
    if (data.targetJobId) {
      const existing = await db
        .select()
        .from(applicants)
        .where(
          and(
            eq(applicants.email, data.email),
            eq(applicants.targetJobId, data.targetJobId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return { success: false, error: "You have already applied for this position." };
      }
    }

    let finalJobTitle = data.jobTitle;

    // If a targetJobId is provided, sync the jobTitle text field with the actual job title + ID
    if (data.targetJobId) {
      const jobData = await db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(eq(jobs.id, data.targetJobId)).limit(1);
      if (jobData[0]) {
        finalJobTitle = `${jobData[0].title} (#${jobData[0].id.toString().padStart(4, '0')})`;
      }
    }

    const newCandidate = await db.insert(applicants).values({
      userId: recruiterUserId, // Always assigned to the recruiter who created the job
      clerkUserId: candidateClerkUserId || null, // Link to candidate's Clerk identity (null for anonymous)
      targetJobId: data.targetJobId,
      jobTitle: finalJobTitle,
      name: data.name,
      email: data.email,
      phone: data.phone,
      resumeText: data.resumeText,
      resumeUrl: data.resumeUrl || null,
      resumeFileName: data.resumeFileName || null,
      resumePublicId: data.resumePublicId || null,
      status: "Ready",
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    }).returning();

    // Trigger AI Matching in the background (or await if you want immediate feedback)
    if (newCandidate[0].id) {
       const { calculateMatchScore } = await import("./matching");
       await calculateMatchScore(newCandidate[0].id);

       try {
         await sendInterviewInviteEmail({
           candidateId: newCandidate[0].id,
           candidateName: newCandidate[0].name,
           candidateEmail: newCandidate[0].email,
           jobTitle: finalJobTitle ?? null,
           scheduledAt: newCandidate[0].scheduledAt,
           emailType: "invite",
         });

         await db
           .update(applicants)
           .set({ lastNotifiedAt: new Date() })
           .where(eq(applicants.id, newCandidate[0].id));
       } catch (emailError) {
         console.error("Error sending interview invite email:", emailError);
       }

       // Notify the recruiter about the new candidate (side effect only).
       try {
         const { notifyApplicationCreated } = await import("@/lib/notifications");
         await notifyApplicationCreated(newCandidate[0].id);
       } catch (notifyError) {
         console.error("Error sending new-candidate notification:", notifyError);
       }

       // Enroll candidate in the first pipeline round (if pipeline exists)
       let firstCandidateRoundId: number | undefined = undefined;
       if (data.targetJobId) {
         try {
           const [pipeline] = await db
             .select({ id: pipelines.id })
             .from(pipelines)
             .where(eq(pipelines.jobId, data.targetJobId))
             .limit(1);

           if (pipeline) {
             const [firstRound] = await db
               .select({ id: pipelineRounds.id })
               .from(pipelineRounds)
               .where(eq(pipelineRounds.pipelineId, pipeline.id))
               .orderBy(pipelineRounds.order)
               .limit(1);

             if (firstRound) {
               const crInserted = await db.insert(candidateRounds).values({
                 candidateId: newCandidate[0].id,
                 roundId: firstRound.id,
                 status: "ACTIVE",
                 startedAt: new Date(),
               }).returning({ id: candidateRounds.id });
               firstCandidateRoundId = crInserted[0]?.id;
             }
           }
         } catch (enrollError) {
           // Pipeline enrollment failure should not block candidate creation
           console.error("Error enrolling candidate in pipeline:", enrollError);
         }

         // Trigger automated Resume Screening (fire-and-forget)
         try {
           const { completeScreeningRound } = await import("@/lib/pipeline-internal");
           await completeScreeningRound({ candidateId: newCandidate[0].id });
         } catch (screeningError) {
           console.error("Error running automated resume screening:", screeningError);
         }
       }

       // Create formal Schedule entity if scheduledAt is provided
       if (data.scheduledAt) {
         try {
           const { createSchedule } = await import("@/lib/scheduling");
           await createSchedule({
             candidateId: newCandidate[0].id,
             candidateRoundId: firstCandidateRoundId,
             recruiterUserId,
             scheduledAt: new Date(data.scheduledAt),
             durationMinutes: 45,
             timezone: "Asia/Kolkata",
           });
         } catch (schedErr) {
           console.error("Error creating formal schedule record:", schedErr);
         }
       }
    }

    revalidatePath("/dashboard");
    return { success: true, candidate: newCandidate[0] };
  } catch (error) {
    console.error("Error creating candidate:", error);
    return { success: false, error: "Failed to create candidate" };
  }
}

export async function getCandidates(jobId?: number) {
  const { userId } = await auth();
  
  if (!userId) {
    return [];
  }

  try {
    const whereClause = jobId
      ? and(eq(applicants.userId, userId), eq(applicants.targetJobId, jobId))
      : eq(applicants.userId, userId);

    const data = await db.select({
      id: applicants.id,
      name: applicants.name,
      email: applicants.email,
      phone: applicants.phone,
      status: applicants.status,
      score: applicants.score,
      matchScore: applicants.matchScore,
      jobTitle: applicants.jobTitle,
      targetJobId: applicants.targetJobId,
      resumeUrl: applicants.resumeUrl,
      resumeFileName: applicants.resumeFileName,
      resumeText: applicants.resumeText,
      scheduledAt: applicants.scheduledAt,
      createdAt: applicants.createdAt,
      linkedJobTitle: jobs.title,
    })
    .from(applicants)
    .leftJoin(jobs, eq(applicants.targetJobId, jobs.id))
    .where(whereClause);
    
    // ─── Bulk pipeline enrichment (no N+1) ──────────────────────────
    // Fetch pipelines, rounds, and candidate_rounds for ALL returned
    // candidates in a few grouped queries, then assemble in JS.
    const candidateIds = data.map((c) => c.id);
    const jobIds = data
      .map((c) => c.targetJobId)
      .filter((id): id is number => id !== null);

    const pipelineByJob = new Map<number, number>();
    const roundsByPipeline = new Map<
      number,
      { id: number; type: string; name: string | null; order: number }[]
    >();
    const crByCandidate = new Map<
      number,
      {
        roundId: number;
        status: string;
        score: number | null;
        startedAt: Date | null;
        completedAt: Date | null;
      }[]
    >();

    if (jobIds.length > 0) {
      const pipelineRows = await db
        .select({ id: pipelines.id, jobId: pipelines.jobId })
        .from(pipelines)
        .where(inArray(pipelines.jobId, jobIds));

      for (const p of pipelineRows) pipelineByJob.set(p.jobId, p.id);

      const pipelineIds = pipelineRows.map((p) => p.id);
      if (pipelineIds.length > 0) {
        const roundRows = await db
          .select({
            id: pipelineRounds.id,
            pipelineId: pipelineRounds.pipelineId,
            type: pipelineRounds.type,
            name: pipelineRounds.name,
            order: pipelineRounds.order,
          })
          .from(pipelineRounds)
          .where(inArray(pipelineRounds.pipelineId, pipelineIds))
          .orderBy(asc(pipelineRounds.order));

        for (const r of roundRows) {
          const list = roundsByPipeline.get(r.pipelineId) ?? [];
          list.push({
            id: r.id,
            type: r.type,
            name: r.name,
            order: r.order,
          });
          roundsByPipeline.set(r.pipelineId, list);
        }
      }
    }

    if (candidateIds.length > 0) {
      const crRows = await db
        .select({
          candidateId: candidateRounds.candidateId,
          roundId: candidateRounds.roundId,
          status: candidateRounds.status,
          score: candidateRounds.score,
          startedAt: candidateRounds.startedAt,
          completedAt: candidateRounds.completedAt,
        })
        .from(candidateRounds)
        .where(inArray(candidateRounds.candidateId, candidateIds));

      for (const cr of crRows) {
        const list = crByCandidate.get(cr.candidateId) ?? [];
        list.push(cr);
        crByCandidate.set(cr.candidateId, list);
      }
    }

    // Dynamically update status to 'Missed' if past scheduledAt and not completed
    const now = new Date();
    return data.map((c) => {
      let status = c.status;
      if (status !== "Completed" && c.scheduledAt && new Date(c.scheduledAt) < now) {
        status = "Missed";
      }
      if (status === "Ready" && c.scheduledAt && new Date(c.scheduledAt) >= now) {
        status = "Scheduled";
      }

      const rounds = c.targetJobId
        ? roundsByPipeline.get(pipelineByJob.get(c.targetJobId) ?? -1) ?? []
        : [];
      const crs = crByCandidate.get(c.id) ?? [];
      const crByRound = new Map(crs.map((cr) => [cr.roundId, cr]));

      // Current stage: first ACTIVE round, else first PENDING round (pipeline order).
      let currentStageType: string | null = null;
      let currentStageName: string | null = null;
      let currentStageStatus: string | null = null;

      for (const r of rounds) {
        const cr = crByRound.get(r.id);
        if (cr && cr.status === "ACTIVE") {
          currentStageType = r.type;
          currentStageName = r.name;
          currentStageStatus = "ACTIVE";
          break;
        }
      }
      if (!currentStageStatus) {
        for (const r of rounds) {
          const cr = crByRound.get(r.id);
          if (cr && cr.status === "PENDING") {
            currentStageType = r.type;
            currentStageName = r.name;
            currentStageStatus = "PENDING";
            break;
          }
        }
      }
      // If the candidate failed somewhere, surface the failed stage.
      if (!currentStageStatus) {
        for (const r of rounds) {
          const cr = crByRound.get(r.id);
          if (cr && cr.status === "FAILED") {
            currentStageType = r.type;
            currentStageName = r.name;
            currentStageStatus = "FAILED";
            break;
          }
        }
      }

      const statuses = rounds.map((r) => crByRound.get(r.id)?.status ?? "NOT_STARTED");
      const pipelineStatus =
        rounds.length === 0
          ? "no-pipeline"
          : statuses.includes("FAILED")
            ? "failed"
            : currentStageStatus
              ? "in-progress"
              : statuses.every((s) => s === "PASSED" || s === "SKIPPED")
                ? "complete"
                : "not-started";

      const needsReview =
        currentStageStatus === "ACTIVE" && currentStageType === "MANUAL_REVIEW";

      let assessmentScore: number | null = null;
      let interviewScore: number | null = null;
      for (const r of rounds) {
        const cr = crByRound.get(r.id);
        if (!cr) continue;
        if (r.type === "ASSESSMENT" && cr.score !== null) assessmentScore = cr.score;
        if (r.type === "AI_INTERVIEW" && cr.score !== null) interviewScore = cr.score;
      }
      // Legacy fallback: interview score stored on the applicant row.
      if (interviewScore === null && c.score) {
        const parsed = parseInt(c.score, 10);
        if (!Number.isNaN(parsed)) interviewScore = parsed;
      }

      const timestamps = [new Date(c.createdAt).getTime()];
      const terminalCompletions: number[] = [];
      for (const cr of crs) {
        if (cr.startedAt) timestamps.push(new Date(cr.startedAt).getTime());
        if (cr.completedAt) {
          timestamps.push(new Date(cr.completedAt).getTime());
          if (["PASSED", "FAILED", "SKIPPED"].includes(cr.status)) {
            terminalCompletions.push(new Date(cr.completedAt).getTime());
          }
        }
      }

      return {
        ...c,
        status,
        currentStageType,
        currentStageName,
        currentStageStatus,
        pipelineStatus,
        needsReview,
        assessmentScore,
        interviewScore,
        lastActivityAt: new Date(Math.max(...timestamps)),
        stageCompletedAt:
          terminalCompletions.length > 0
            ? new Date(Math.max(...terminalCompletions))
            : null,
      };
    });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    return [];
  }
}

export async function getCandidateById(id: number) {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    // Scope by userId so recruiters can only ever fetch their own candidates
    const data = await db.select({
      id: applicants.id,
      name: applicants.name,
      email: applicants.email,
      phone: applicants.phone,
      jobTitle: applicants.jobTitle,
      targetJobId: applicants.targetJobId,
      resumeUrl: applicants.resumeUrl,
      resumeFileName: applicants.resumeFileName,
      resumeText: applicants.resumeText,
      linkedJobTitle: jobs.title,
    })
    .from(applicants)
    .leftJoin(jobs, eq(applicants.targetJobId, jobs.id))
    .where(and(eq(applicants.id, id), eq(applicants.userId, userId)))
    .limit(1);
    
    return data[0] ?? null;
  } catch (error) {
    console.error("Error fetching candidate:", error);
    return null;
  }
}

export async function rescheduleCandidate(id: number, newDate: string, reason?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (Number.isNaN(Date.parse(newDate))) {
    return { success: false, error: "Invalid date" };
  }

  try {
    const newScheduledAt = new Date(newDate);

    // Look for existing schedule record
    const { schedules } = await import("@/db/schema");
    const existingSched = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.candidateId, id), eq(schedules.recruiterUserId, userId)))
      .orderBy(desc(schedules.createdAt))
      .limit(1);

    if (existingSched[0]?.id) {
      const { rescheduleSchedule } = await import("@/lib/scheduling");
      const res = await rescheduleSchedule({
        scheduleId: existingSched[0].id,
        newScheduledAt,
        recruiterUserId: userId,
        reason,
      });

      if (!res.success) {
        return { success: false, error: res.error };
      }
    } else {
      // Create new schedule if none exists yet
      const { createSchedule } = await import("@/lib/scheduling");
      const res = await createSchedule({
        candidateId: id,
        recruiterUserId: userId,
        scheduledAt: newScheduledAt,
      });

      if (!res.success) {
        return { success: false, error: res.error };
      }
    }

    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/candidates");
    return { success: true };
  } catch (error) {
    console.error("Error rescheduling candidate:", error);
    return { success: false, error: "Failed to reschedule" };
  }
}

export async function cancelScheduleAction(scheduleId: number, reason?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const { cancelSchedule } = await import("@/lib/scheduling");
    const res = await cancelSchedule({ scheduleId, recruiterUserId: userId, reason });
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/candidates");
    return res;
  } catch (error) {
    console.error("Error cancelling schedule:", error);
    return { success: false, error: "Failed to cancel schedule" };
  }
}

export async function getRecruiterSchedulesAction() {
  const { userId } = await auth();
  if (!userId) return [];

  try {
    const { schedules, scheduleLogs, applicants, candidateRounds, pipelineRounds, jobs } = await import("@/db/schema");
    const rows = await db
      .select({
        id: schedules.id,
        candidateId: schedules.candidateId,
        candidateRoundId: schedules.candidateRoundId,
        scheduledAt: schedules.scheduledAt,
        durationMinutes: schedules.durationMinutes,
        timezone: schedules.timezone,
        status: schedules.status,
        meetingProvider: schedules.meetingProvider,
        meetingUrl: schedules.meetingUrl,
        cancellationReason: schedules.cancellationReason,
        createdAt: schedules.createdAt,
        candidateName: applicants.name,
        candidateEmail: applicants.email,
        candidatePhone: applicants.phone,
        applicantStatus: applicants.status,
        jobTitle: applicants.jobTitle,
        linkedJobTitle: jobs.title,
        roundName: pipelineRounds.name,
        roundType: pipelineRounds.type,
      })
      .from(schedules)
      .innerJoin(applicants, eq(schedules.candidateId, applicants.id))
      .leftJoin(jobs, eq(applicants.targetJobId, jobs.id))
      .leftJoin(candidateRounds, eq(schedules.candidateRoundId, candidateRounds.id))
      .leftJoin(pipelineRounds, eq(candidateRounds.roundId, pipelineRounds.id))
      .where(eq(schedules.recruiterUserId, userId))
      .orderBy(desc(schedules.scheduledAt));

    // Fetch logs for each schedule
    const scheduleIds = rows.map((r) => r.id);
    const logsMap = new Map<number, Array<Record<string, unknown>>>();
    if (scheduleIds.length > 0) {
      const logs = await db
        .select()
        .from(scheduleLogs)
        .where(inArray(scheduleLogs.scheduleId, scheduleIds))
        .orderBy(desc(scheduleLogs.createdAt));

      for (const log of logs) {
        const list = logsMap.get(log.scheduleId) || [];
        list.push(log);
        logsMap.set(log.scheduleId, list);
      }
    }

    return rows.map((r) => ({
      ...r,
      logs: logsMap.get(r.id) || [],
    }));
  } catch (error) {
    console.error("Error fetching recruiter schedules:", error);
    return [];
  }
}

export async function updateCandidate(id: number, data: {
  name?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  targetJobId?: number;
  scheduledAt?: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Validate all input server-side (server actions are client-callable)
  const validation = UpdateCandidateSchema.safeParse(data);
  if (!validation.success) {
    const message = validation.error.issues[0]?.message ?? "Invalid input";
    return { success: false, error: message };
  }
  data = validation.data as typeof data;

  try {
    let finalJobTitle = data.jobTitle;

    if (data.targetJobId) {
      const jobData = await db
        .select({ title: jobs.title })
        .from(jobs)
        .where(and(eq(jobs.id, data.targetJobId), eq(jobs.userId, userId)))
        .limit(1);
      if (jobData[0]) {
        finalJobTitle = jobData[0].title;
      }
    }

    const updated = await db.update(applicants)
      .set({
        ...data,
        jobTitle: finalJobTitle,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      })
      .where(and(eq(applicants.id, id), eq(applicants.userId, userId)))
      .returning({ id: applicants.id });

    if (updated.length === 0) {
      return { success: false, error: "Candidate not found or access denied" };
    }

    if (data.scheduledAt) {
      const { schedules } = await import("@/db/schema");
      const existing = await db
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(eq(schedules.candidateId, id), eq(schedules.recruiterUserId, userId)))
        .orderBy(desc(schedules.createdAt))
        .limit(1);

      if (existing[0]?.id) {
        const { rescheduleSchedule } = await import("@/lib/scheduling");
        await rescheduleSchedule({
          scheduleId: existing[0].id,
          newScheduledAt: new Date(data.scheduledAt),
          recruiterUserId: userId,
          reason: "Candidate details updated",
        });
      } else {
        const { createSchedule } = await import("@/lib/scheduling");
        await createSchedule({
          candidateId: id,
          recruiterUserId: userId,
          scheduledAt: new Date(data.scheduledAt),
        });
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/candidates");
    revalidatePath("/dashboard/schedules");
    return { success: true };
  } catch (error) {
    console.error("Error updating candidate:", error);
    return { success: false };
  }
}
