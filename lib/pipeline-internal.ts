/**
 * Internal pipeline helpers.
 *
 * IMPORTANT: This module deliberately does NOT contain `"use server"`.
 * The functions here are called only from authorized server-side code
 * (server actions and API routes). Keeping them out of a server-actions
 * module prevents them from being invoked directly by clients.
 */

import { db } from "@/db";
import { applicants, candidateRounds, pipelineRounds, pipelines, jobs } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { runResumeScreening } from "@/lib/screening";

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

// ─── Complete Resume Screening Round (automated) ──────────────────
// This is an internal helper triggered from createCandidate().
// It does NOT require Clerk auth because the trigger originates from
// an already-authorized server action. Authorization is inherited
// from the createCandidate() call chain.
export async function completeScreeningRound({
  candidateId,
}: {
  candidateId: number;
}) {
  try {
    // 1. Find the candidate and their linked job
    const [candidate] = await db
      .select({
        id: applicants.id,
        targetJobId: applicants.targetJobId,
        resumeText: applicants.resumeText,
        name: applicants.name,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!candidate) {
      return { success: false, error: "Candidate not found" };
    }

    if (!candidate.targetJobId) {
      return { success: false, error: "Candidate has no linked job" };
    }

    if (!candidate.resumeText) {
      return { success: false, error: "Candidate has no resume text" };
    }

    // 2. Find the pipeline for this candidate's job
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, candidate.targetJobId))
      .limit(1);

    if (!pipeline) {
      return { success: false, error: "No pipeline found for this job" };
    }

    // 3. Find the RESUME_SCREENING round in this pipeline
    const [screeningRound] = await db
      .select({
        id: pipelineRounds.id,
        order: pipelineRounds.order,
        configuration: pipelineRounds.configuration,
      })
      .from(pipelineRounds)
      .where(
        and(
          eq(pipelineRounds.pipelineId, pipeline.id),
          eq(pipelineRounds.type, "RESUME_SCREENING")
        )
      )
      .limit(1);

    if (!screeningRound) {
      return { success: false, error: "No RESUME_SCREENING round found in pipeline" };
    }

    // 4. Find existing candidate_round for this round (duplicate protection)
    const [existingRound] = await db
      .select({
        id: candidateRounds.id,
        status: candidateRounds.status,
      })
      .from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.roundId, screeningRound.id)
        )
      )
      .limit(1);

    // 5. Duplicate protection: skip if already completed
    if (
      existingRound &&
      (existingRound.status === "PASSED" || existingRound.status === "FAILED")
    ) {
      return {
        success: true,
        skipped: true,
        reason: "Screening already completed",
        data: {
          roundStatus: existingRound.status,
        },
      };
    }

    // 6. Soft lock: only process if status is ACTIVE (not already being processed)
    if (existingRound && existingRound.status !== "ACTIVE") {
      return {
        success: false,
        error: `Round is in unexpected status: ${existingRound.status}`,
      };
    }

    // 7. Load job details
    const [job] = await db
      .select({
        title: jobs.title,
        description: jobs.description,
        requirements: jobs.requirements,
      })
      .from(jobs)
      .where(eq(jobs.id, candidate.targetJobId))
      .limit(1);

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    // 8. Extract passThreshold from pipeline round configuration
    const config = screeningRound.configuration as Record<string, unknown> | null;
    const passThreshold =
      typeof config?.passThreshold === "number" ? config.passThreshold : 50;

    // 9. Run the screening
    const screeningResult = await runResumeScreening({
      candidateId,
      jobTitle: job.title,
      jobDescription: job.description,
      jobRequirements: job.requirements,
      resumeText: candidate.resumeText,
      passThreshold,
    });

    if (!screeningResult.success) {
      // AI failed — keep round ACTIVE, do not corrupt state
      console.error("[Screening] Screening failed, keeping round ACTIVE", {
        candidateId,
        error: screeningResult.error,
      });
      return { success: false, error: screeningResult.error };
    }

    // 10. Determine round status (map PASS/FAIL to PASSED/FAILED for candidate_rounds)
    const roundStatus: "PASSED" | "FAILED" = screeningResult.decision === "PASS" ? "PASSED" : "FAILED";

    // 11. Update the candidate_round with results
    if (existingRound) {
      await db
        .update(candidateRounds)
        .set({
          status: roundStatus,
          score: screeningResult.score,
          feedback: screeningResult.result.summary,
          evaluation: screeningResult.result,
          completedAt: new Date(),
        })
        .where(eq(candidateRounds.id, existingRound.id));
    } else {
      // Create the candidate_round (shouldn't normally happen, but safe fallback)
      await db.insert(candidateRounds).values({
        candidateId,
        roundId: screeningRound.id,
        status: roundStatus,
        score: screeningResult.score,
        feedback: screeningResult.result.summary,
        evaluation: screeningResult.result,
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // 12. If PASSED, activate the next round
    let nextRoundActivated = false;

    if (roundStatus === "PASSED") {
      const nextRound = await getNextPipelineRound(
        pipeline.id,
        screeningRound.order
      );

      if (nextRound) {
        // Deactivate any existing ACTIVE round for this candidate
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

        // Check if a candidate_round already exists for the next round
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

        nextRoundActivated = true;
      }
    }

    revalidatePath("/dashboard/candidates");

    return {
      success: true,
      data: {
        roundStatus,
        score: screeningResult.score,
        nextRoundActivated,
      },
    };
  } catch (error) {
    console.error("[Screening] Error completing screening round:", {
      candidateId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to complete screening round" };
  }
}