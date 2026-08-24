"use server";

import { db } from "@/db";
import { applicants, candidateRounds, pipelineRounds, pipelines, jobs } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, asc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─── Allowed statuses ─────────────────────────────────────────────
const ALLOWED_STATUSES = ["PENDING", "ACTIVE", "PASSED", "FAILED", "SKIPPED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

// ─── Helper: Get the next pipeline round by order ─────────────────
export async function getNextPipelineRound(
  pipelineId: number,
  currentOrder: number
) {
  // Find the round whose order is strictly greater than currentOrder
  const allRounds = await db
    .select({
      id: pipelineRounds.id,
      name: pipelineRounds.name,
      type: pipelineRounds.type,
      order: pipelineRounds.order,
    })
    .from(pipelineRounds)
    .where(eq(pipelineRounds.pipelineId, pipelineId))
    .orderBy(asc(pipelineRounds.order));

  const nextRoundActual = allRounds.find((r) => r.order > currentOrder);
  return nextRoundActual ?? null;
}

// ─── Helper: Verify recruiter ownership through the chain ─────────
async function verifyRecruiterOwnership(userId: string, targetJobId: number) {
  const [job] = await db
    .select({ userId: jobs.userId })
    .from(jobs)
    .where(eq(jobs.id, targetJobId))
    .limit(1);

  if (!job) {
    return { authorized: false, error: "Job not found" };
  }

  if (job.userId !== userId) {
    return { authorized: false, error: "Unauthorized: this candidate belongs to another recruiter's job" };
  }

  return { authorized: true };
}

// ─── Existing: Get Candidate Pipeline ─────────────────────────────
export async function getCandidatePipeline(candidateId: number) {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    // Fetch the candidate
    const [candidate] = await db
      .select({
        id: applicants.id,
        name: applicants.name,
        email: applicants.email,
        targetJobId: applicants.targetJobId,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!candidate) return null;

    if (!candidate.targetJobId) {
      return { candidate, rounds: [] };
    }

    // Find the pipeline for this candidate's job
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, candidate.targetJobId))
      .limit(1);

    if (!pipeline) {
      return { candidate, rounds: [] };
    }

    // Get all rounds for this pipeline, ordered
    const rounds = await db
      .select({
        id: pipelineRounds.id,
        name: pipelineRounds.name,
        type: pipelineRounds.type,
        order: pipelineRounds.order,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.pipelineId, pipeline.id))
      .orderBy(asc(pipelineRounds.order));

    // Get all candidate_rounds for this candidate
    const candidateRoundData = await db
      .select({
        id: candidateRounds.id,
        roundId: candidateRounds.roundId,
        status: candidateRounds.status,
        score: candidateRounds.score,
        feedback: candidateRounds.feedback,
        evaluation: candidateRounds.evaluation,
        startedAt: candidateRounds.startedAt,
        completedAt: candidateRounds.completedAt,
      })
      .from(candidateRounds)
      .where(eq(candidateRounds.candidateId, candidateId));

    // Create a lookup map for quick access
    const roundMap = new Map(
      candidateRoundData.map((cr) => [cr.roundId, cr])
    );

    // Merge pipeline rounds with candidate progress
    const roundsWithStatus = rounds.map((round) => {
      const candidateRound = roundMap.get(round.id);
      return {
        roundId: round.id,
        candidateRoundId: candidateRound?.id ?? null,
        name: round.name,
        type: round.type,
        order: round.order,
        status: candidateRound?.status ?? "NOT_STARTED",
        score: candidateRound?.score ?? null,
        feedback: candidateRound?.feedback ?? null,
        evaluation: candidateRound?.evaluation ?? null,
        startedAt: candidateRound?.startedAt ?? null,
        completedAt: candidateRound?.completedAt ?? null,
      };
    });

    return { candidate, rounds: roundsWithStatus };
  } catch (error) {
    console.error("Error fetching candidate pipeline:", error);
    return null;
  }
}

// ─── Move Candidate to a Specific Round ───────────────────────────
export async function moveCandidateToRound({
  candidateId,
  roundId,
}: {
  candidateId: number;
  roundId: number;
}) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 1. Verify candidate exists
    const [candidate] = await db
      .select({
        id: applicants.id,
        targetJobId: applicants.targetJobId,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!candidate) {
      return { success: false, error: "Candidate not found" };
    }

    if (!candidate.targetJobId) {
      return { success: false, error: "Candidate is not linked to a job" };
    }

    // 2. Verify recruiter ownership
    const ownership = await verifyRecruiterOwnership(userId, candidate.targetJobId);
    if (!ownership.authorized) {
      return { success: false, error: ownership.error };
    }

    // 3. Verify the target round belongs to the pipeline of that job
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, candidate.targetJobId))
      .limit(1);

    if (!pipeline) {
      return { success: false, error: "No pipeline found for this job" };
    }

    const [targetRound] = await db
      .select({
        id: pipelineRounds.id,
        pipelineId: pipelineRounds.pipelineId,
        order: pipelineRounds.order,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, roundId))
      .limit(1);

    if (!targetRound || targetRound.pipelineId !== pipeline.id) {
      return { success: false, error: "Round does not belong to this job's pipeline" };
    }

    // 4. Check if candidate already has an ACTIVE round — deactivate it
    const [existingActive] = await db
      .select({ id: candidateRounds.id })
      .from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.status, "ACTIVE")
        )
      )
      .limit(1);

    if (existingActive && existingActive.id !== roundId) {
      // Complete the old active round as SKIPPED (preserve history)
      await db
        .update(candidateRounds)
        .set({
          status: "SKIPPED",
          completedAt: new Date(),
        })
        .where(eq(candidateRounds.id, existingActive.id));
    }

    // 5. Find or create the candidate_round record for the target round
    const [existingCandidateRound] = await db
      .select({ id: candidateRounds.id, status: candidateRounds.status })
      .from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.roundId, roundId)
        )
      )
      .limit(1);

    let resultRound;

    if (existingCandidateRound) {
      // Update existing record to ACTIVE
      const [updated] = await db
        .update(candidateRounds)
        .set({
          status: "ACTIVE",
          startedAt: existingCandidateRound.status === "PENDING" ? new Date() : undefined,
        })
        .where(eq(candidateRounds.id, existingCandidateRound.id))
        .returning();
      resultRound = updated;
    } else {
      // Create new candidate_round
      const [created] = await db
        .insert(candidateRounds)
        .values({
          candidateId,
          roundId,
          status: "ACTIVE",
          startedAt: new Date(),
        })
        .returning();
      resultRound = created;
    }

    revalidatePath("/dashboard/candidates");

    return {
      success: true,
      data: {
        candidateRoundId: resultRound.id,
        roundId,
        status: "ACTIVE",
      },
    };
  } catch (error) {
    console.error("Error moving candidate to round:", error);
    return { success: false, error: "Failed to move candidate to round" };
  }
}

// ─── Update Candidate Round Status ────────────────────────────────
export async function updateCandidateRoundStatus({
  candidateRoundId,
  status,
  score,
  feedback,
  evaluation,
}: {
  candidateRoundId: number;
  status: AllowedStatus;
  score?: number | null;
  feedback?: string | null;
  evaluation?: Record<string, unknown> | null;
}) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 1. Validate status
    if (!ALLOWED_STATUSES.includes(status)) {
      return { success: false, error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` };
    }

    // 2. Fetch the candidate_round and verify ownership through the chain
    const [candidateRound] = await db
      .select({
        id: candidateRounds.id,
        status: candidateRounds.status,
        roundId: candidateRounds.roundId,
        startedAt: candidateRounds.startedAt,
        completedAt: candidateRounds.completedAt,
      })
      .from(candidateRounds)
      .where(eq(candidateRounds.id, candidateRoundId))
      .limit(1);

    if (!candidateRound) {
      return { success: false, error: "Candidate round not found" };
    }

    // 3. Verify ownership: candidate_round → pipeline_round → pipeline → job → job.userId
    const [pipelineRound] = await db
      .select({
        pipelineId: pipelineRounds.pipelineId,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, candidateRound.roundId))
      .limit(1);

    if (!pipelineRound) {
      return { success: false, error: "Pipeline round not found" };
    }

    const [pipeline] = await db
      .select({ jobId: pipelines.jobId })
      .from(pipelines)
      .where(eq(pipelines.id, pipelineRound.pipelineId))
      .limit(1);

    if (!pipeline) {
      return { success: false, error: "Pipeline not found" };
    }

    const ownership = await verifyRecruiterOwnership(userId, pipeline.jobId);
    if (!ownership.authorized) {
      return { success: false, error: ownership.error };
    }

    // 4. Build the update payload with only provided fields
    const updateData: Record<string, unknown> = { status };

    if (score !== undefined) updateData.score = score;
    if (feedback !== undefined) updateData.feedback = feedback;
    if (evaluation !== undefined) updateData.evaluation = evaluation;

    // 5. Handle timestamp logic
    if (status === "ACTIVE" && !candidateRound.startedAt) {
      updateData.startedAt = new Date();
    }

    if (["PASSED", "FAILED", "SKIPPED"].includes(status)) {
      updateData.completedAt = new Date();
    }

    // 6. Perform the update
    const [updated] = await db
      .update(candidateRounds)
      .set(updateData)
      .where(eq(candidateRounds.id, candidateRoundId))
      .returning();

    revalidatePath("/dashboard/candidates");

    return {
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        score: updated.score,
        feedback: updated.feedback,
        evaluation: updated.evaluation,
        startedAt: updated.startedAt,
        completedAt: updated.completedAt,
      },
    };
  } catch (error) {
    console.error("Error updating candidate round status:", error);
    return { success: false, error: "Failed to update candidate round status" };
  }
}

// ─── Complete a Candidate Round (PASSED/FAILED) ───────────────────
export async function completeCandidateRound({
  candidateRoundId,
  status,
  score,
  feedback,
  evaluation,
}: {
  candidateRoundId: number;
  status: "PASSED" | "FAILED";
  score?: number | null;
  feedback?: string | null;
  evaluation?: Record<string, unknown> | null;
}) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 1. Validate status
    if (status !== "PASSED" && status !== "FAILED") {
      return { success: false, error: "Only PASSED or FAILED are accepted" };
    }

    // 2. Fetch the candidate_round
    const [candidateRound] = await db
      .select({
        id: candidateRounds.id,
        candidateId: candidateRounds.candidateId,
        roundId: candidateRounds.roundId,
        status: candidateRounds.status,
      })
      .from(candidateRounds)
      .where(eq(candidateRounds.id, candidateRoundId))
      .limit(1);

    if (!candidateRound) {
      return { success: false, error: "Candidate round not found" };
    }

    // 3. Verify ownership through the chain
    const [pipelineRound] = await db
      .select({
        id: pipelineRounds.id,
        pipelineId: pipelineRounds.pipelineId,
        order: pipelineRounds.order,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, candidateRound.roundId))
      .limit(1);

    if (!pipelineRound) {
      return { success: false, error: "Pipeline round not found" };
    }

    const [pipeline] = await db
      .select({ id: pipelines.id, jobId: pipelines.jobId })
      .from(pipelines)
      .where(eq(pipelines.id, pipelineRound.pipelineId))
      .limit(1);

    if (!pipeline) {
      return { success: false, error: "Pipeline not found" };
    }

    const ownership = await verifyRecruiterOwnership(userId, pipeline.jobId);
    if (!ownership.authorized) {
      return { success: false, error: ownership.error };
    }

    // 4. Update the current candidate_round
    const [updated] = await db
      .update(candidateRounds)
      .set({
        status,
        score: score ?? undefined,
        feedback: feedback ?? undefined,
        evaluation: evaluation ?? undefined,
        completedAt: new Date(),
      })
      .where(eq(candidateRounds.id, candidateRoundId))
      .returning();

    // 5. If PASSED, find and activate the next round
    let nextRoundActivated = false;
    let pipelineCompleted = false;

    if (status === "PASSED") {
      const nextRound = await getNextPipelineRound(
        pipelineRound.pipelineId,
        pipelineRound.order
      );

      if (nextRound) {
        // Deactivate any existing ACTIVE round for this candidate (preserve history)
        const [currentActive] = await db
          .select({ id: candidateRounds.id })
          .from(candidateRounds)
          .where(
            and(
              eq(candidateRounds.candidateId, candidateRound.candidateId),
              eq(candidateRounds.status, "ACTIVE")
            )
          )
          .limit(1);

        if (currentActive) {
          await db
            .update(candidateRounds)
            .set({
              status: "SKIPPED",
              completedAt: new Date(),
            })
            .where(eq(candidateRounds.id, currentActive.id));
        }

        // Check if a candidate_round already exists for this next round
        const [existingNext] = await db
          .select({ id: candidateRounds.id })
          .from(candidateRounds)
          .where(
            and(
              eq(candidateRounds.candidateId, candidateRound.candidateId),
              eq(candidateRounds.roundId, nextRound.id)
            )
          )
          .limit(1);

        if (existingNext) {
          // Reactivate if it was previously started
          await db
            .update(candidateRounds)
            .set({
              status: "ACTIVE",
              startedAt: new Date(),
            })
            .where(eq(candidateRounds.id, existingNext.id));
        } else {
          // Create a new candidate_round for the next round
          await db.insert(candidateRounds).values({
            candidateId: candidateRound.candidateId,
            roundId: nextRound.id,
            status: "ACTIVE",
            startedAt: new Date(),
          });
        }

        nextRoundActivated = true;
      } else {
        // No next round — pipeline completed
        pipelineCompleted = true;
      }
    }

    revalidatePath("/dashboard/candidates");

    return {
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        score: updated.score,
        feedback: updated.feedback,
        evaluation: updated.evaluation,
        startedAt: updated.startedAt,
        completedAt: updated.completedAt,
        nextRoundActivated,
        pipelineCompleted,
      },
    };
  } catch (error) {
    console.error("Error completing candidate round:", error);
    return { success: false, error: "Failed to complete candidate round" };
  }
}

// ─── Complete AI Interview Round (called from interview completion API)
// This is an internal helper used by the interview completion API.
// It does NOT require Clerk auth because the interview API uses its own
// candidate-based auth model (candidate ID in the request body).
// Authorization is enforced by the interview API itself.
export async function completeAIRound({
  candidateId,
  score,
  summary,
  evaluation,
}: {
  candidateId: number;
  score: number;
  summary: string | null;
  evaluation: Record<string, unknown> | null;
}) {
  try {
    // 1. Find the candidate's target job
    const [candidate] = await db
      .select({ targetJobId: applicants.targetJobId })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!candidate || !candidate.targetJobId) {
      return { success: false, error: "Candidate has no linked job" };
    }

    // 2. Find the pipeline for that job
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, candidate.targetJobId))
      .limit(1);

    if (!pipeline) {
      return { success: false, error: "No pipeline found for this job" };
    }

    // 3. Find the AI_INTERVIEW round in this pipeline
    const [aiRound] = await db
      .select({
        id: pipelineRounds.id,
        order: pipelineRounds.order,
      })
      .from(pipelineRounds)
      .where(
        and(
          eq(pipelineRounds.pipelineId, pipeline.id),
          eq(pipelineRounds.type, "AI_INTERVIEW")
        )
      )
      .limit(1);

    if (!aiRound) {
      return { success: false, error: "No AI_INTERVIEW round found in pipeline" };
    }

    // 4. Determine pass/fail based on score
    const roundStatus: "PASSED" | "FAILED" = score >= 50 ? "PASSED" : "FAILED";

    // 5. Find existing candidate_round for this round (avoid duplicates)
    const [existingRound] = await db
      .select({ id: candidateRounds.id, status: candidateRounds.status })
      .from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.roundId, aiRound.id)
        )
      )
      .limit(1);

    // 6. Create or update the candidate_round
    if (existingRound) {
      // Only update if not already completed (PASSED or FAILED)
      if (existingRound.status !== "PASSED" && existingRound.status !== "FAILED") {
        await db
          .update(candidateRounds)
          .set({
            status: roundStatus,
            score,
            feedback: summary,
            evaluation,
            completedAt: new Date(),
          })
          .where(eq(candidateRounds.id, existingRound.id));
      }
    } else {
      await db.insert(candidateRounds).values({
        candidateId,
        roundId: aiRound.id,
        status: roundStatus,
        score,
        feedback: summary,
        evaluation,
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // 7. If PASSED, activate the next round
    if (roundStatus === "PASSED") {
      const nextRound = await getNextPipelineRound(pipeline.id, aiRound.order);

      if (nextRound) {
        // Deactivate any existing ACTIVE round for this candidate (preserve history)
        const [currentActive] = await db
          .select({ id: candidateRounds.id })
          .from(candidateRounds)
          .where(
            and(
              eq(candidateRounds.candidateId, candidateId),
              eq(candidateRounds.status, "ACTIVE")
            )
          )
          .limit(1);

        if (currentActive) {
          await db
            .update(candidateRounds)
            .set({
              status: "SKIPPED",
              completedAt: new Date(),
            })
            .where(eq(candidateRounds.id, currentActive.id));
        }

        const [existingNext] = await db
          .select({ id: candidateRounds.id })
          .from(candidateRounds)
          .where(
            and(
              eq(candidateRounds.candidateId, candidateId),
              eq(candidateRounds.roundId, nextRound.id)
            )
          )
          .limit(1);

        if (existingNext) {
          await db
            .update(candidateRounds)
            .set({
              status: "ACTIVE",
              startedAt: new Date(),
            })
            .where(eq(candidateRounds.id, existingNext.id));
        } else {
          await db.insert(candidateRounds).values({
            candidateId,
            roundId: nextRound.id,
            status: "ACTIVE",
            startedAt: new Date(),
          });
        }
      }
    }

    return {
      success: true,
      data: {
        roundStatus,
        score,
        nextRoundActivated: roundStatus === "PASSED",
      },
    };
  } catch (error) {
    console.error("Error completing AI round:", error);
    return { success: false, error: "Failed to update pipeline round" };
  }
}
