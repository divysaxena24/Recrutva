import "server-only";
import { db } from "@/db";
import { applicants, jobs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRedis } from "@/lib/redis";
import { sendEmail, getAppUrl } from "@/lib/email";
import {
  buildAssessmentAvailableEmail,
  buildInterviewAvailableEmail,
  buildStagePassedEmail,
  buildNotProgressingEmail,
  buildRecruiterNewCandidateEmail,
  buildRecruiterManualReviewEmail,
  buildRecruiterAssessmentCompletedEmail,
  buildRecruiterInterviewCompletedEmail,
} from "@/lib/email-templates";

/**
 * Centralized recruitment notifications (Day 8 Phase 4).
 *
 * Emails are SIDE EFFECTS of pipeline transitions. They are triggered only
 * from server-side business logic (candidate creation, screening/assessment/
 * interview completion, recruiter round actions) — never from client code.
 *
 * Hard rules:
 * - Recipients are derived server-side from candidate/job/recruiter records.
 *   A client can never specify a recipient.
 * - A notification is sent once per meaningful transition (Redis SET NX
 *   idempotency key with a TTL; fails open when Redis is unavailable).
 * - Email failures never throw to callers and never affect business state —
 *   they are logged and swallowed.
 * - No secrets, candidate PII, or internal evaluation data is ever logged.
 */

const NOTIFY_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Acquire a one-time notification lock.
 * Returns true when the notification should proceed (either the lock was
 * acquired, or Redis is unavailable/errored and we fail open).
 */
export async function acquireNotificationLock(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // fail open: no Redis, no dedupe

  try {
    const result = await redis.set(key, "1", {
      ex: NOTIFY_TTL_SECONDS,
      nx: true,
    });
    // NX returns null when the key already exists (already notified).
    return result !== null;
  } catch (err) {
    // Lock failure must never block the notification (or the transaction).
    console.error(
      "[Notifications] Idempotency lock failed (failing open):",
      err instanceof Error ? err.message : "Unknown error"
    );
    return true;
  }
}

async function notifyOnce(
  lockKey: string,
  send: () => Promise<void>
): Promise<void> {
  const proceed = await acquireNotificationLock(lockKey);
  if (!proceed) return;

  try {
    await send();
  } catch (err) {
    // Never propagate — email delivery is a side effect.
    console.error(
      "[Notifications] Notification send failed:",
      err instanceof Error ? err.message : "Unknown error"
    );
  }
}

// ─── Recipient/context resolution (server-side only) ───────────────

interface CandidateContext {
  candidate: {
    id: number;
    name: string;
    email: string;
    jobTitle: string | null;
  };
  jobTitle: string;
  jobId: number | null;
  recruiterEmail: string | null;
}

async function loadCandidateContext(candidateId: number): Promise<CandidateContext | null> {
  try {
    const [candidate] = await db
      .select({
        id: applicants.id,
        name: applicants.name,
        email: applicants.email,
        jobTitle: applicants.jobTitle,
        targetJobId: applicants.targetJobId,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!candidate) return null;

    let jobTitle = candidate.jobTitle ?? "the position";
    let recruiterEmail: string | null = null;
    let jobId: number | null = candidate.targetJobId;

    if (candidate.targetJobId) {
      const [job] = await db
        .select({ title: jobs.title, userId: jobs.userId })
        .from(jobs)
        .where(eq(jobs.id, candidate.targetJobId))
        .limit(1);

      if (job) {
        jobTitle = job.title;
        recruiterEmail = await resolveRecruiterEmail(job.userId);
      }
    }

    return {
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        jobTitle: candidate.jobTitle,
      },
      jobTitle,
      jobId,
      recruiterEmail,
    };
  } catch (err) {
    console.error(
      "[Notifications] Failed to load candidate context:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return null;
  }
}

/**
 * Resolve the owning recruiter's email for a job.
 * Prefers the users table; falls back to the Clerk backend API (jobs.userId is
 * a Clerk ID). Returns null when the recruiter cannot be resolved — the
 * notification is then skipped gracefully.
 */
async function resolveRecruiterEmail(clerkId: string): Promise<string | null> {
  // 1. users table (populated in deployments that sync recruiter profiles)
  try {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (user?.email) return user.email;
  } catch {
    // fall through to Clerk lookup
  }

  // 2. Clerk backend API
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    return email ?? null;
  } catch (err) {
    console.error(
      "[Notifications] Could not resolve recruiter email:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return null;
  }
}

function recruiterReviewUrl(jobId: number | null): string {
  return `${getAppUrl()}/dashboard/candidates${jobId ? `?jobId=${jobId}` : ""}`;
}

// ─── Notification triggers ─────────────────────────────────────────

/**
 * Application created.
 *
 * Candidate side: the existing immediate interview-invite email (sent by
 * createCandidate) already confirms the application was received — sending a
 * second "application received" email would duplicate it. This trigger sends
 * the recruiter "new candidate" notification.
 */
export async function notifyApplicationCreated(candidateId: number): Promise<void> {
  const ctx = await loadCandidateContext(candidateId);
  if (!ctx || !ctx.recruiterEmail) return;
  const { candidate, jobTitle, recruiterEmail, jobId } = ctx;

  await notifyOnce(`recrutva:notify:application-created:${candidateId}`, async () => {
    const { subject, html } = buildRecruiterNewCandidateEmail({
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      jobTitle,
      candidatesUrl: recruiterReviewUrl(jobId),
    });
    await sendEmail({ to: recruiterEmail, subject, html });
  });
}

/**
 * A pipeline round was activated (candidate moved into it).
 * - ASSESSMENT → candidate "assessment available"
 * - AI_INTERVIEW → candidate "interview available"
 * - MANUAL_REVIEW → recruiter "candidate requires review"
 */
export async function notifyRoundActivated(
  candidateId: number,
  candidateRoundId: number,
  roundType: string,
  _roundName: string
): Promise<void> {
  const ctx = await loadCandidateContext(candidateId);
  if (!ctx) return;
  const { candidate, jobTitle, recruiterEmail, jobId } = ctx;

  if (roundType === "ASSESSMENT") {
    await notifyOnce(`recrutva:notify:round-activated:${candidateRoundId}`, async () => {
      const { subject, html } = buildAssessmentAvailableEmail({
        candidateName: candidate.name,
        jobTitle,
        candidateId,
      });
      await sendEmail({ to: candidate.email, subject, html });
    });
    return;
  }

  if (roundType === "AI_INTERVIEW") {
    await notifyOnce(`recrutva:notify:round-activated:${candidateRoundId}`, async () => {
      const { subject, html } = buildInterviewAvailableEmail({
        candidateName: candidate.name,
        jobTitle,
        candidateId,
      });
      await sendEmail({ to: candidate.email, subject, html });
    });
    return;
  }

  if (roundType === "MANUAL_REVIEW") {
    if (!recruiterEmail) return;
    await notifyOnce(`recrutva:notify:manual-review:${candidateRoundId}`, async () => {
      const { subject, html } = buildRecruiterManualReviewEmail({
        candidateName: candidate.name,
        jobTitle,
        reviewUrl: recruiterReviewUrl(jobId),
      });
      await sendEmail({ to: recruiterEmail, subject, html });
    });
    return;
  }

  // Custom round types produce no notification.
}

/**
 * A pipeline round reached a terminal state (PASSED or FAILED).
 *
 * FAILED → candidate "application not progressing".
 * PASSED  → recruiter "assessment/interview completed" (unless the recruiter
 *           performed the completion themselves), then either a specialized
 *           next-stage email (assessment/interview available) or a generic
 *           "stage passed" confirmation + manual-review recruiter email.
 */
export async function notifyRoundCompleted(input: {
  candidateId: number;
  candidateRoundId: number;
  round: { id: number; type: string; name: string };
  status: "PASSED" | "FAILED";
  score: number | null;
  activatedRound: { id: number; type: string; name: string } | null;
  /** Set false when the recruiter completed the round themselves (avoids emailing them about their own action). */
  notifyRecruiterCompletion?: boolean;
}): Promise<void> {
  const ctx = await loadCandidateContext(input.candidateId);
  if (!ctx) return;
  const { candidate, jobTitle, recruiterEmail, jobId } = ctx;
  const notifyRecruiterCompletion = input.notifyRecruiterCompletion !== false;

  if (input.status === "FAILED") {
    await notifyOnce(`recrutva:notify:round-failed:${input.candidateRoundId}`, async () => {
      const { subject, html } = buildNotProgressingEmail({
        candidateName: candidate.name,
        jobTitle,
        stageName: input.round.name,
      });
      await sendEmail({ to: candidate.email, subject, html });
    });
    return;
  }

  // PASSED
  if (
    notifyRecruiterCompletion &&
    recruiterEmail &&
    (input.round.type === "ASSESSMENT" || input.round.type === "AI_INTERVIEW")
  ) {
    const isAssessment = input.round.type === "ASSESSMENT";
    const lockKey = `recrutva:notify:recruiter-${isAssessment ? "assessment" : "interview"}-completed:${input.candidateRoundId}`;
    await notifyOnce(lockKey, async () => {
      const { subject, html } = isAssessment
        ? buildRecruiterAssessmentCompletedEmail({
            candidateName: candidate.name,
            jobTitle,
            score: input.score,
            reviewUrl: recruiterReviewUrl(jobId),
          })
        : buildRecruiterInterviewCompletedEmail({
            candidateName: candidate.name,
            jobTitle,
            score: input.score,
            reviewUrl: recruiterReviewUrl(jobId),
          });
      await sendEmail({ to: recruiterEmail, subject, html });
    });
  }

  if (input.activatedRound) {
    if (
      input.activatedRound.type === "ASSESSMENT" ||
      input.activatedRound.type === "AI_INTERVIEW"
    ) {
      // Specialized next-stage email — the clearest single message.
      await notifyRoundActivated(
        input.candidateId,
        input.activatedRound.id,
        input.activatedRound.type,
        input.activatedRound.name
      );
    } else {
      const nextStep =
        input.activatedRound.type === "MANUAL_REVIEW"
          ? "Your application is now under recruiter review."
          : "We'll be in touch with the next steps.";
      await notifyOnce(`recrutva:notify:stage-passed:${input.candidateRoundId}`, async () => {
        const { subject, html } = buildStagePassedEmail({
          candidateName: candidate.name,
          jobTitle,
          stageName: input.round.name,
          nextStep,
        });
        await sendEmail({ to: candidate.email, subject, html });
      });

      if (input.activatedRound.type === "MANUAL_REVIEW") {
        await notifyRoundActivated(
          input.candidateId,
          input.activatedRound.id,
          input.activatedRound.type,
          input.activatedRound.name
        );
      }
    }
  } else {
    // No next round — the candidate completed the available stages.
    await notifyOnce(`recrutva:notify:stage-passed:${input.candidateRoundId}`, async () => {
      const { subject, html } = buildStagePassedEmail({
        candidateName: candidate.name,
        jobTitle,
        stageName: input.round.name,
        nextStep:
          "You've completed all the stages of the application process. Our team will be in touch with the outcome.",
      });
      await sendEmail({ to: candidate.email, subject, html });
    });
  }
}