"use server";

import { db } from "@/db";
import { applicants, jobs } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";

export async function getApplicationsByJobId(jobId: number) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Unauthorized" as const };
  }

  try {
    // Verify job exists and belongs to the authenticated recruiter
    const jobData = await db
      .select({ id: jobs.id, userId: jobs.userId, title: jobs.title })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (jobData.length === 0) {
      return { success: false, error: "Job not found" as const };
    }

    if (jobData[0].userId !== userId) {
      return { success: false, error: "Access denied" as const };
    }

    // Fetch applicants for this job, ordered by most recent first
    // Bound the result set to prevent unbounded queries
    const applications = await db
      .select({
        id: applicants.id,
        name: applicants.name,
        email: applicants.email,
        phone: applicants.phone,
        resumeUrl: applicants.resumeUrl,
        resumeFileName: applicants.resumeFileName,
        matchScore: applicants.matchScore,
        status: applicants.status,
        analysis: applicants.analysis,
        createdAt: applicants.createdAt,
      })
      .from(applicants)
      .where(eq(applicants.targetJobId, jobId))
      .orderBy(desc(applicants.createdAt))
      .limit(500);

    return {
      success: true as const,
      jobTitle: jobData[0].title,
      applications,
    };
  } catch (error) {
    console.error("Error fetching applications:", error);
    return { success: false, error: "Failed to fetch applications" as const };
  }
}
