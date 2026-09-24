"use server";

import { completeScreeningRound } from "@/lib/pipeline-internal";

/**
 * Calculate candidate ATS match score using the full structured screening engine.
 * Ensures matchScore, score, summary, and candidate_rounds are perfectly in sync.
 */
export async function calculateMatchScore(candidateId: number) {
  try {
    const result = await completeScreeningRound({ candidateId });
    if (result.success) {
      console.log(`[ATS Scorer] Evaluated candidate #${candidateId}:`, result);
    } else {
      console.warn(`[ATS Scorer] Evaluation skipped or failed for #${candidateId}:`, result);
    }
  } catch (error) {
    console.error("[ATS Scorer] Failure calculating match score:", {
      candidateId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Server action to re-screen a candidate and recalculate their ATS match score on demand.
 */
export async function rescreenCandidate(candidateId: number) {
  try {
    const result = await completeScreeningRound({ candidateId });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.data };
  } catch (error) {
    console.error("[ATS Scorer] Re-screening error:", error);
    return { success: false, error: "Failed to recalculate ATS score" };
  }
}
