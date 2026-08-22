"use server";

import { db } from "@/db";
import { applicants, candidateRounds, pipelineRounds, pipelines } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, asc } from "drizzle-orm";

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
