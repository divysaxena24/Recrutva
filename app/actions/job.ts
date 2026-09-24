"use server";

import { db } from "@/db";
import { jobs, pipelines, pipelineRounds, candidateRounds, applicants, PUBLIC_JOB_STATUSES } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { CreateJobSchema } from "@/lib/schemas/actions";

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

  // Validate all input server-side (server actions are client-callable)
  const validation = CreateJobSchema.safeParse(data);
  if (!validation.success) {
    const message = validation.error.issues[0]?.message ?? "Invalid input";
    return { success: false, error: message };
  }
  data = validation.data as typeof data;

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
    // 1. Verify job exists and caller is owner
    const existing = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: "Job not found or access denied" };
    }

    // 2. Cascade delete pipeline & applicant relationships to prevent FK constraint errors
    const jobPipelines = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, id));

    if (jobPipelines.length > 0) {
      const pipelineIds = jobPipelines.map((p) => p.id);

      const rounds = await db
        .select({ id: pipelineRounds.id })
        .from(pipelineRounds)
        .where(inArray(pipelineRounds.pipelineId, pipelineIds));

      if (rounds.length > 0) {
        const roundIds = rounds.map((r) => r.id);
        await db.delete(candidateRounds).where(inArray(candidateRounds.roundId, roundIds));
        await db.delete(pipelineRounds).where(inArray(pipelineRounds.pipelineId, pipelineIds));
      }

      await db.delete(pipelines).where(eq(pipelines.jobId, id));
    }

    // Unlink applicants associated with this job
    await db
      .update(applicants)
      .set({ targetJobId: null })
      .where(eq(applicants.targetJobId, id));

    // 3. Delete the job row itself
    const deleted = await db
      .delete(jobs)
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

    // Public listing — never expose the recruiter's userId, and bound the
    // result set so the query cannot grow without limits.
    // Includes both AI-published jobs and the legacy "Open" status so
    // existing listings keep appearing.
    const result = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        requirements: jobs.requirements,
        location: jobs.location,
        status: jobs.status,
        department: jobs.department,
        employmentType: jobs.employmentType,
        experience: jobs.experience,
        workMode: jobs.workMode,
        salaryRange: jobs.salaryRange,
        requiredSkills: jobs.requiredSkills,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(inArray(jobs.status, [...PUBLIC_JOB_STATUSES]))
      .limit(200);

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
    const { userId } = await auth();

    // Check cache first
    const cacheKey = CACHE_KEYS.job(id);
    const cached = await cacheGet<{
      id: number;
      title: string;
      description: string | null;
      requirements: string | null;
      location: string | null;
      status: string;
      createdAt: Date | null;
      userId: string;
    }>(cacheKey);
    if (cached) return toPublicJob(cached, userId);

    const data = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        requirements: jobs.requirements,
        location: jobs.location,
        status: jobs.status,
        createdAt: jobs.createdAt,
        userId: jobs.userId,
      })
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);
    const job = data[0];

    // Cache the full row (draft visibility is resolved per caller on read)
    if (job) {
      await cacheSet(cacheKey, job, CACHE_TTL.job);
    }

    return toPublicJob(job ?? null, userId);
  } catch (error) {
    console.error("Error fetching job by id:", error);
    return null;
  }
}

/**
 * Drafts are visible only to their owning recruiter; every other status
 * (PUBLISHED and the legacy "Open") stays publicly accessible. The owner's
 * userId is never included in the returned shape.
 */
function toPublicJob(
  job: {
    id: number;
    title: string;
    description: string | null;
    requirements: string | null;
    location: string | null;
    status: string;
    createdAt: Date | null;
    userId: string;
  } | null,
  viewerUserId: string | null,
) {
  if (!job) return null;
  if (job.status === "DRAFT" && job.userId !== viewerUserId) return null;
  // Explicit allowlist — new columns never leak into the public shape.
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    requirements: job.requirements,
    location: job.location,
    status: job.status,
    createdAt: job.createdAt,
  };
}
