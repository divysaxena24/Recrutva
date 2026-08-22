"use server";

import { db } from "@/db";
import { jobs, pipelines, pipelineRounds, candidateRounds } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq, and, asc, sql } from "drizzle-orm";

// ─── Helpers ───────────────────────────────────────────────────────

async function verifyJobOwnership(jobId: number, userId: string) {
  const [job] = await db
    .select({ id: jobs.id, userId: jobs.userId })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job) {
    return { valid: false as const, error: "Job not found" as const };
  }
  if (job.userId !== userId) {
    return { valid: false as const, error: "Access denied" as const };
  }
  return { valid: true as const };
}

async function verifyPipelineOwnership(pipelineId: number, userId: string) {
  const [pipeline] = await db
    .select({ id: pipelines.id, jobId: pipelines.jobId })
    .from(pipelines)
    .where(eq(pipelines.id, pipelineId))
    .limit(1);

  if (!pipeline) {
    return { valid: false as const, error: "Pipeline not found" as const };
  }

  const ownership = await verifyJobOwnership(pipeline.jobId, userId);
  if (!ownership.valid) {
    return { valid: false as const, error: ownership.error };
  }

  return { valid: true as const, pipeline };
}

// ─── 1. Create Pipeline ────────────────────────────────────────────

export async function createPipeline(jobId: number, name?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const ownership = await verifyJobOwnership(jobId, userId);
    if (!ownership.valid) {
      return { success: false, error: ownership.error };
    }

    // Fetch job title for the default pipeline name
    const [job] = await db
      .select({ title: jobs.title })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    const pipelineName = name || `${job!.title} Pipeline`;

    const [newPipeline] = await db
      .insert(pipelines)
      .values({
        jobId,
        name: pipelineName,
      })
      .returning();

    revalidatePath("/dashboard/jobs");
    return { success: true, pipeline: newPipeline };
  } catch (error) {
    console.error("Error creating pipeline:", error);
    return { success: false, error: "Failed to create pipeline" };
  }
}

// ─── 2. Get Pipeline by Job ID ─────────────────────────────────────

export async function getPipelineByJobId(jobId: number) {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const ownership = await verifyJobOwnership(jobId, userId);
    if (!ownership.valid) return null;

    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.jobId, jobId))
      .limit(1);

    if (!pipeline) return null;

    const rounds = await db
      .select()
      .from(pipelineRounds)
      .where(eq(pipelineRounds.pipelineId, pipeline.id))
      .orderBy(asc(pipelineRounds.order));

    return { ...pipeline, rounds };
  } catch (error) {
    console.error("Error fetching pipeline:", error);
    return null;
  }
}

// ─── 3. Add Pipeline Round ─────────────────────────────────────────

export async function addPipelineRound(data: {
  pipelineId: number;
  name: string;
  type: string;
  configuration?: Record<string, unknown>;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const ownership = await verifyPipelineOwnership(data.pipelineId, userId);
    if (!ownership.valid) {
      return { success: false, error: ownership.error };
    }

    // Auto-assign next order number
    const [maxOrder] = await db
      .select({
        maxOrder: sql<number>`coalesce(max(${pipelineRounds.order}), 0)`,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.pipelineId, data.pipelineId));

    const nextOrder = (maxOrder?.maxOrder ?? 0) + 1;

    const [newRound] = await db
      .insert(pipelineRounds)
      .values({
        pipelineId: data.pipelineId,
        name: data.name,
        type: data.type,
        order: nextOrder,
        configuration: data.configuration || {},
      })
      .returning();

    revalidatePath("/dashboard/jobs");
    return { success: true, round: newRound };
  } catch (error) {
    console.error("Error adding pipeline round:", error);
    return { success: false, error: "Failed to add pipeline round" };
  }
}

// ─── 4. Update Round Order ─────────────────────────────────────────

export async function updateRoundOrder(data: {
  roundId: number;
  newOrder: number;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    // Fetch the round and its pipeline
    const [round] = await db
      .select()
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, data.roundId))
      .limit(1);

    if (!round) {
      return { success: false, error: "Round not found" };
    }

    const ownership = await verifyPipelineOwnership(round.pipelineId, userId);
    if (!ownership.valid) {
      return { success: false, error: ownership.error };
    }

    const oldOrder = round.order;
    const newOrder = data.newOrder;

    if (oldOrder === newOrder) {
      return { success: true };
    }

    // Shift other rounds to make space
    if (newOrder > oldOrder) {
      // Moving down: shift rounds between (oldOrder, newOrder] up by -1
      await db
        .update(pipelineRounds)
        .set({ order: sql`${pipelineRounds.order} - 1` })
        .where(
          and(
            eq(pipelineRounds.pipelineId, round.pipelineId),
            sql`${pipelineRounds.order} > ${oldOrder} AND ${pipelineRounds.order} <= ${newOrder}`
          )
        );
    } else {
      // Moving up: shift rounds between [newOrder, oldOrder) down by +1
      await db
        .update(pipelineRounds)
        .set({ order: sql`${pipelineRounds.order} + 1` })
        .where(
          and(
            eq(pipelineRounds.pipelineId, round.pipelineId),
            sql`${pipelineRounds.order} >= ${newOrder} AND ${pipelineRounds.order} < ${oldOrder}`
          )
        );
    }

    // Set the target round to its new order
    await db
      .update(pipelineRounds)
      .set({ order: newOrder })
      .where(eq(pipelineRounds.id, data.roundId));

    revalidatePath("/dashboard/jobs");
    return { success: true };
  } catch (error) {
    console.error("Error updating round order:", error);
    return { success: false, error: "Failed to update round order" };
  }
}

// ─── 5. Delete Pipeline Round ──────────────────────────────────────

export async function deletePipelineRound(roundId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const [round] = await db
      .select()
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, roundId))
      .limit(1);

    if (!round) {
      return { success: false, error: "Round not found" };
    }

    const ownership = await verifyPipelineOwnership(round.pipelineId, userId);
    if (!ownership.valid) {
      return { success: false, error: ownership.error };
    }

    // Check if any candidates are actively in this round
    const [activeCandidate] = await db
      .select({ id: candidateRounds.id })
      .from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.roundId, roundId),
          sql`${candidateRounds.status} IN ('PENDING', 'ACTIVE')`
        )
      )
      .limit(1);

    if (activeCandidate) {
      return {
        success: false,
        error: "Cannot delete round with candidates in PENDING or ACTIVE status",
      };
    }

    // Delete the round
    await db.delete(pipelineRounds).where(eq(pipelineRounds.id, roundId));

    // Shift down all rounds that were after the deleted one
    await db
      .update(pipelineRounds)
      .set({ order: sql`${pipelineRounds.order} - 1` })
      .where(
        and(
          eq(pipelineRounds.pipelineId, round.pipelineId),
          sql`${pipelineRounds.order} > ${round.order}`
        )
      );

    revalidatePath("/dashboard/jobs");
    return { success: true };
  } catch (error) {
    console.error("Error deleting pipeline round:", error);
    return { success: false, error: "Failed to delete pipeline round" };
  }
}
