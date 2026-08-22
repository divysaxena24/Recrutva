"use server";

import { db } from "@/db";
import { jobs, pipelines, pipelineRounds } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

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
    return await db.select({
      id: jobs.id,
      userId: jobs.userId,
      title: jobs.title,
      description: jobs.description,
      location: jobs.location,
      status: jobs.status,
      createdAt: jobs.createdAt,
    }).from(jobs).where(eq(jobs.userId, userId));
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

    revalidatePath("/dashboard/jobs");
    return { success: true };
  } catch (error) {
    console.error("Error deleting job:", error);
    return { success: false, error: "Failed to delete job" };
  }
}
export async function getAllJobs() {
  try {
    return await db.select().from(jobs).where(eq(jobs.status, "Open"));
  } catch (error) {
    console.error("Error fetching all jobs:", error);
    return [];
  }
}

export async function getJobById(id: number) {
  try {
    const data = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    return data[0];
  } catch (error) {
    console.error("Error fetching job by id:", error);
    return null;
  }
}
