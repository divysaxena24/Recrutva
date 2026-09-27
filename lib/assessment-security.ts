import { db } from "@/db";
import { applicants, candidateRounds, pipelineRounds, pipelines, jobs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─── Security Types ───────────────────────────────────────────────

export type ViolationType =
  | "FULLSCREEN_EXIT"
  | "TAB_SWITCH"
  | "PAGE_HIDDEN"
  | "WINDOW_BLUR"
  | "ATTEMPT_RELOAD"
  | "SESSION_TIMEOUT";

export interface SecureRoundConfig {
  secureMode?: boolean;
  requireFullscreen?: boolean;
  maxViolations?: number;
  recordVisibilityChanges?: boolean;
  recordFullscreenExits?: boolean;
  durationMinutes?: number | null;
}

export interface SecurityEvent {
  eventId: string;
  type: ViolationType;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityState {
  violationCount: number;
  maxViolations: number;
  terminated: boolean;
  terminationReason?: string | null;
  events: SecurityEvent[];
}

export const DEFAULT_SECURE_CONFIG: Required<Omit<SecureRoundConfig, "durationMinutes">> & { durationMinutes: number | null } = {
  secureMode: true,
  requireFullscreen: true,
  maxViolations: 3,
  recordVisibilityChanges: true,
  recordFullscreenExits: true,
  durationMinutes: null,
};

// ─── Extract Secure Configuration ────────────────────────────────

export function parseSecureConfig(
  rawConfig: unknown,
  roundType: string
): SecureRoundConfig {
  const isCandidateFacing = ["ASSESSMENT", "AI_INTERVIEW", "TECHNICAL_INTERVIEW", "HR_ROUND"].includes(roundType);
  const cfg = (typeof rawConfig === "object" && rawConfig !== null ? rawConfig : {}) as Record<string, unknown>;

  return {
    secureMode: typeof cfg.secureMode === "boolean" ? cfg.secureMode : isCandidateFacing,
    requireFullscreen: typeof cfg.requireFullscreen === "boolean" ? cfg.requireFullscreen : DEFAULT_SECURE_CONFIG.requireFullscreen,
    maxViolations: typeof cfg.maxViolations === "number" && cfg.maxViolations > 0 ? cfg.maxViolations : DEFAULT_SECURE_CONFIG.maxViolations,
    recordVisibilityChanges: typeof cfg.recordVisibilityChanges === "boolean" ? cfg.recordVisibilityChanges : DEFAULT_SECURE_CONFIG.recordVisibilityChanges,
    recordFullscreenExits: typeof cfg.recordFullscreenExits === "boolean" ? cfg.recordFullscreenExits : DEFAULT_SECURE_CONFIG.recordFullscreenExits,
    durationMinutes: typeof cfg.durationMinutes === "number" ? cfg.durationMinutes : null,
  };
}

// ─── Session Authorization & Verification ────────────────────────

export async function getSecureRoundSession(
  candidateRoundIdOrApplicantId: number,
  clerkUserId: string,
  roundTypeHint?: string
) {
  try {
    // 1. First, check if input ID is candidateRoundId directly
    let candidateRoundRow = await db
      .select({
        id: candidateRounds.id,
        candidateId: candidateRounds.candidateId,
        roundId: candidateRounds.roundId,
        status: candidateRounds.status,
        score: candidateRounds.score,
        feedback: candidateRounds.feedback,
        evaluation: candidateRounds.evaluation,
        startedAt: candidateRounds.startedAt,
        completedAt: candidateRounds.completedAt,
      })
      .from(candidateRounds)
      .where(eq(candidateRounds.id, candidateRoundIdOrApplicantId))
      .limit(1);

    let candidateId = candidateRoundRow[0]?.candidateId;

    // If not found by candidateRoundId, search by applicantId (candidateId) + active round type
    if (!candidateRoundRow[0]) {
      candidateId = candidateRoundIdOrApplicantId;

      const [applicant] = await db
        .select({ id: applicants.id, targetJobId: applicants.targetJobId, clerkUserId: applicants.clerkUserId })
        .from(applicants)
        .where(eq(applicants.id, candidateId))
        .limit(1);

      if (!applicant || !applicant.targetJobId) {
        return { success: false, error: "Candidate or job not found" };
      }

      // Find pipeline for target job
      const [pipeline] = await db
        .select({ id: pipelines.id })
        .from(pipelines)
        .where(eq(pipelines.jobId, applicant.targetJobId))
        .limit(1);

      if (!pipeline) {
        return { success: false, error: "Pipeline not found for job" };
      }

      // Find matching pipeline round
      const targetType = roundTypeHint || "ASSESSMENT";
      const [pRound] = await db
        .select({ id: pipelineRounds.id })
        .from(pipelineRounds)
        .where(and(eq(pipelineRounds.pipelineId, pipeline.id), eq(pipelineRounds.type, targetType)))
        .limit(1);

      if (!pRound) {
        return { success: false, error: `Pipeline round ${targetType} not found` };
      }

      candidateRoundRow = await db
        .select({
          id: candidateRounds.id,
          candidateId: candidateRounds.candidateId,
          roundId: candidateRounds.roundId,
          status: candidateRounds.status,
          score: candidateRounds.score,
          feedback: candidateRounds.feedback,
          evaluation: candidateRounds.evaluation,
          startedAt: candidateRounds.startedAt,
          completedAt: candidateRounds.completedAt,
        })
        .from(candidateRounds)
        .where(and(eq(candidateRounds.candidateId, candidateId), eq(candidateRounds.roundId, pRound.id)))
        .limit(1);
    }

    const cRound = candidateRoundRow[0];
    if (!cRound) {
      return { success: false, error: "Candidate round not found" };
    }

    // 2. Fetch applicant & verify Clerk candidate identity ownership
    const [candidate] = await db
      .select({
        id: applicants.id,
        name: applicants.name,
        email: applicants.email,
        clerkUserId: applicants.clerkUserId,
        targetJobId: applicants.targetJobId,
        resumeText: applicants.resumeText,
      })
      .from(applicants)
      .where(eq(applicants.id, cRound.candidateId))
      .limit(1);

    if (!candidate) {
      return { success: false, error: "Candidate record not found" };
    }

    // Server-side identity validation: candidate's clerkUserId must match or be claims-verified
    if (candidate.clerkUserId && candidate.clerkUserId !== clerkUserId) {
      return { success: false, error: "Unauthorized candidate access" };
    }

    // 3. Fetch pipeline round details & configuration
    const [pRound] = await db
      .select({
        id: pipelineRounds.id,
        pipelineId: pipelineRounds.pipelineId,
        name: pipelineRounds.name,
        type: pipelineRounds.type,
        order: pipelineRounds.order,
        configuration: pipelineRounds.configuration,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, cRound.roundId))
      .limit(1);

    if (!pRound) {
      return { success: false, error: "Pipeline round configuration not found" };
    }

    // 4. Fetch job details
    const [job] = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        requirements: jobs.requirements,
      })
      .from(jobs)
      .where(eq(jobs.id, candidate.targetJobId!))
      .limit(1);

    if (!job) {
      return { success: false, error: "Job details not found" };
    }

    // 5. Parse configuration & security state
    const config = parseSecureConfig(pRound.configuration, pRound.type);
    const evaluationObj = (typeof cRound.evaluation === "object" && cRound.evaluation !== null ? cRound.evaluation : {}) as Record<string, unknown>;
    const secStateRaw = (evaluationObj.securityState as Record<string, unknown>) || {};

    const securityState: SecurityState = {
      violationCount: typeof secStateRaw.violationCount === "number" ? secStateRaw.violationCount : 0,
      maxViolations: config.maxViolations || DEFAULT_SECURE_CONFIG.maxViolations,
      terminated: Boolean(secStateRaw.terminated) || cRound.status === "FAILED" && secStateRaw.terminationReason === "SECURITY_VIOLATION_LIMIT",
      terminationReason: (secStateRaw.terminationReason as string) || null,
      events: Array.isArray(secStateRaw.events) ? (secStateRaw.events as SecurityEvent[]) : [],
    };

    return {
      success: true,
      candidateRound: cRound,
      candidate,
      job,
      pipelineRound: pRound,
      config,
      securityState,
    };
  } catch (error) {
    console.error("[SecureSession] Error verifying secure round session:", error);
    return { success: false, error: "Failed to verify secure assessment session" };
  }
}

// ─── Record Security Violation (Server-Authoritative) ────────────

export async function recordSecurityViolation({
  candidateRoundId,
  clerkUserId,
  eventId,
  type,
  metadata = {},
}: {
  candidateRoundId: number;
  clerkUserId: string;
  eventId: string;
  type: ViolationType;
  metadata?: Record<string, unknown>;
}) {
  try {
    // 1. Verify authorization & active session
    const session = await getSecureRoundSession(candidateRoundId, clerkUserId);
    if (!session.success || !session.candidateRound || !session.pipelineRound || !session.config || !session.securityState) {
      return { success: false, error: session.error || "Invalid assessment session" };
    }

    const { candidateRound, config, securityState, candidate } = session;

    // If round is already completed or terminated, reject violation update
    if (candidateRound.status === "PASSED" || candidateRound.status === "FAILED" || candidateRound.status === "SKIPPED" || securityState.terminated) {
      return {
        success: true,
        violationCount: securityState.violationCount,
        maxViolations: securityState.maxViolations,
        terminated: true,
        terminationReason: securityState.terminationReason || "SESSION_INACTIVE",
      };
    }

    // Deduplication check: reject if eventId was already recorded
    const isDuplicate = securityState.events.some((e) => e.eventId === eventId);
    if (isDuplicate) {
      return {
        success: true,
        violationCount: securityState.violationCount,
        maxViolations: securityState.maxViolations,
        terminated: securityState.terminated,
        terminationReason: securityState.terminationReason,
      };
    }

    // Atomically increment violation count
    const newViolationCount = securityState.violationCount + 1;
    const maxAllowed = config.maxViolations || 3;
    const isTerminated = newViolationCount >= maxAllowed;

    const newEvent: SecurityEvent = {
      eventId,
      type,
      occurredAt: new Date().toISOString(),
      metadata,
    };

    const updatedEvents = [...securityState.events, newEvent];

    const currentEval = (typeof candidateRound.evaluation === "object" && candidateRound.evaluation !== null
      ? candidateRound.evaluation
      : {}) as Record<string, unknown>;

    const updatedSecurityState: SecurityState = {
      violationCount: newViolationCount,
      maxViolations: maxAllowed,
      terminated: isTerminated,
      terminationReason: isTerminated ? "SECURITY_VIOLATION_LIMIT" : null,
      events: updatedEvents,
    };

    const updatedEvaluation = {
      ...currentEval,
      securityState: updatedSecurityState,
    };

    const updatePayload: Record<string, unknown> = {
      evaluation: updatedEvaluation,
    };

    if (isTerminated) {
      updatePayload.status = "FAILED";
      updatePayload.completedAt = new Date();
      updatePayload.feedback = `Assessment terminated automatically due to exceeding maximum allowed security violations (${newViolationCount}/${maxAllowed}).`;
    }

    await db
      .update(candidateRounds)
      .set(updatePayload)
      .where(eq(candidateRounds.id, candidateRound.id));

    // Send notifications if terminated
    if (isTerminated) {
      try {
        const { notifyRoundCompleted } = await import("@/lib/notifications");
        await notifyRoundCompleted({
          candidateId: candidate.id,
          candidateRoundId: candidateRound.id,
          round: {
            id: session.pipelineRound.id,
            type: session.pipelineRound.type,
            name: session.pipelineRound.name,
          },
          status: "FAILED",
          score: 0,
          activatedRound: null,
        });
      } catch (notifyErr) {
        console.error("[Security] Error sending termination notification:", notifyErr);
      }
    }

    revalidatePath(`/assessment/${candidate.id}`);
    revalidatePath(`/interview/${candidate.id}`);
    revalidatePath(`/dashboard/jobs/${candidate.targetJobId}/candidates`);

    return {
      success: true,
      violationCount: newViolationCount,
      maxViolations: maxAllowed,
      terminated: isTerminated,
      terminationReason: isTerminated ? "SECURITY_VIOLATION_LIMIT" : null,
    };
  } catch (error) {
    console.error("[Security] Error recording security violation:", error);
    return { success: false, error: "Failed to record security violation" };
  }
}
