"use server";

import { db } from "@/db";
import { jobs, pipelines, pipelineRounds } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export async function createJob(data: {
  title: string;
  description: string;
  requirements?: string;
  location?: string;
}) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const newJob = await db.insert(jobs).values({
      userId: userId,
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      location: data.location || "Remote",
      status: "Open",
    }).returning();

    // Auto-create a hiring pipeline with default first round
    try {
      const [pipeline] = await db
        .insert(pipelines)
        .values({
          jobId: newJob[0].id,
          name: `${data.title} Pipeline`,
        })
        .returning();

      await db.insert(pipelineRounds).values({
        pipelineId: pipeline.id,
        name: "Resume Screening",
        type: "RESUME_SCREENING",
        order: 1,
      });
    } catch (pipelineError) {
      // Pipeline creation failure should not block job creation
      console.error("Error auto-creating pipeline:", pipelineError);
    }

    // Invalidate caches
    try {
      await cacheDelete(CACHE_KEYS.jobList(userId), CACHE_KEYS.allJobs());
    } catch {
      // Cache invalidation failure is non-critical
    }

    revalidatePath("/dashboard/jobs");
    return { success: true, job: newJob[0] };
  } catch (error) {
    console.error("Error creating job:", error);
    return { success: false, error: "Failed to create job" };
  }
}

export async function getJobs() {
  const { userId } = await auth();

  if (!userId) {
    return [];
  }

  try {
    // Check cache first
    const cacheKey = CACHE_KEYS.jobList(userId);
    const cached = await cacheGet(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const result = await db.select({
      id: jobs.id,
      userId: jobs.userId,
      title: jobs.title,
      description: jobs.description,
      location: jobs.location,
      status: jobs.status,
      createdAt: jobs.createdAt,
    }).from(jobs).where(eq(jobs.userId, userId));

    // Cache the result
    await cacheSet(cacheKey, result, CACHE_TTL.jobList);

    return result;
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }
}

export async function deleteJob(id: number) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const deleted = await db.delete(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning({ id: jobs.id });

    if (deleted.length === 0) {
      return { success: false, error: "Job not found or access denied" };
    }

    // Invalidate caches
    try {
      await cacheDelete(
        CACHE_KEYS.job(id),
        CACHE_KEYS.jobList(userId),
        CACHE_KEYS.allJobs(),
      );
      // Also invalidate any interview questions cached for this job
      await cacheDeletePattern(`recrutva:cache:interview-questions:${id}:*`);
    } catch {
      // Cache invalidation failure is non-critical
    }

    revalidatePath("/dashboard/jobs");
    return { success: true };
  } catch (error) {
    console.error("Error deleting job:", error);
    return { success: false, error: "Failed to delete job" };
  }
}
export async function getAllJobs() {
  try {
    // Check cache first
    const cacheKey = CACHE_KEYS.allJobs();
    const cached = await cacheGet(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const result = await db.select().from(jobs).where(eq(jobs.status, "Open"));

    // Cache the result
    await cacheSet(cacheKey, result, CACHE_TTL.allJobs);

    return result;
  } catch (error) {
    console.error("Error fetching all jobs:", error);
    return [];
  }
}

export async function getJobById(id: number) {
  try {
    // Check cache first
    const cacheKey = CACHE_KEYS.job(id);
    const cached = await cacheGet<{
      id: number;
      userId: string;
      title: string;
      description: string | null;
      requirements: string | null;
      location: string | null;
      status: string;
      createdAt: Date | null;
    }>(cacheKey);
    if (cached) return cached;

    const data = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    const job = data[0];

    // Cache the result (even if null, to avoid repeated DB hits for missing jobs)
    if (job) {
      await cacheSet(cacheKey, job, CACHE_TTL.job);
    }

    return job ?? null;
  } catch (error) {
    console.error("Error fetching job by id:", error);
    return null;
  }
}
