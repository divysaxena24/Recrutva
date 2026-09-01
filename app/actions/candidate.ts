"use server";

import { db } from "@/db";
import { applicants, jobs, pipelines, pipelineRounds, candidateRounds } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq, and, sql, desc } from "drizzle-orm";
import { sendInterviewInviteEmail } from "@/lib/interview-email";

export async function getDashboardStats() {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    // 1. Count active jobs (scoped to this recruiter)
    const [jobsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(and(eq(jobs.userId, userId), eq(jobs.status, "Open")));

    // 2. Count applicants and compute aggregates (scoped to this recruiter)
    const [statsRow] = await db
      .select({
        totalApplicants: sql<number>`count(*)::int`,
        completedInterviews: sql<number>`count(*) filter (where ${applicants.status} = 'Completed')::int`,
        avgFitScore: sql<string>`coalesce(round(avg(${applicants.matchScore}::numeric), 1), '0')`,
      })
      .from(applicants)
      .where(eq(applicants.userId, userId));

    // 3. Get 5 most recent applicants for activity feed
    const recentApplicants = await db
      .select({
        id: applicants.id,
        name: applicants.name,
        status: applicants.status,
        jobTitle: applicants.jobTitle,
        createdAt: applicants.createdAt,
        scheduledAt: applicants.scheduledAt,
      })
      .from(applicants)
      .where(eq(applicants.userId, userId))
      .orderBy(desc(applicants.createdAt))
      .limit(5);

    return {
      activeJobs: jobsRow?.count ?? 0,
      totalApplicants: statsRow?.totalApplicants ?? 0,
      completedInterviews: statsRow?.completedInterviews ?? 0,
      avgFitScore: statsRow?.avgFitScore ?? "0",
      recentApplicants,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return null;
  }
}

export async function createCandidate(data: {
  name: string;
  email: string;
  phone: string;
  resumeText: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumePublicId?: string;
  jobTitle?: string;
  targetJobId?: number;
  scheduledAt?: string;
}) {
  let { userId } = await auth();
  
  // If no logged-in user (public application), we assign to the job's creator
  if (!userId && data.targetJobId) {
    const jobData = await db.select({ userId: jobs.userId }).from(jobs).where(eq(jobs.id, data.targetJobId)).limit(1);
    if (jobData[0]) {
      userId = jobData[0].userId;
    }
  }

  if (!userId) {
    throw new Error("Unauthorized or Job not found");
  }

  try {
    // 1. Prevent Duplicate Applications: Check if this email has already applied for this specific job
    if (data.targetJobId) {
      const existing = await db
        .select()
        .from(applicants)
        .where(
          and(
            eq(applicants.email, data.email),
            eq(applicants.targetJobId, data.targetJobId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return { success: false, error: "You have already applied for this position." };
      }
    }

    let finalJobTitle = data.jobTitle;

    // If a targetJobId is provided, sync the jobTitle text field with the actual job title + ID
    if (data.targetJobId) {
      const jobData = await db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(eq(jobs.id, data.targetJobId)).limit(1);
      if (jobData[0]) {
        finalJobTitle = `${jobData[0].title} (#${jobData[0].id.toString().padStart(4, '0')})`;
      }
    }

    const newCandidate = await db.insert(applicants).values({
      userId: userId,
      targetJobId: data.targetJobId,
      jobTitle: finalJobTitle,
      name: data.name,
      email: data.email,
      phone: data.phone,
      resumeText: data.resumeText,
      resumeUrl: data.resumeUrl || null,
      resumeFileName: data.resumeFileName || null,
      resumePublicId: data.resumePublicId || null,
      status: "Ready",
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    }).returning();

    // Trigger AI Matching in the background (or await if you want immediate feedback)
    if (newCandidate[0].id) {
       const { calculateMatchScore } = await import("./matching");
       await calculateMatchScore(newCandidate[0].id);

       try {
         await sendInterviewInviteEmail({
           candidateId: newCandidate[0].id,
           candidateName: newCandidate[0].name,
           candidateEmail: newCandidate[0].email,
           jobTitle: finalJobTitle ?? null,
           scheduledAt: newCandidate[0].scheduledAt,
           emailType: "invite",
         });

         await db
           .update(applicants)
           .set({ lastNotifiedAt: new Date() })
           .where(eq(applicants.id, newCandidate[0].id));
       } catch (emailError) {
         console.error("Error sending interview invite email:", emailError);
       }

       // Enroll candidate in the first pipeline round (if pipeline exists)
       if (data.targetJobId) {
         try {
           const [pipeline] = await db
             .select({ id: pipelines.id })
             .from(pipelines)
             .where(eq(pipelines.jobId, data.targetJobId))
             .limit(1);

           if (pipeline) {
             const [firstRound] = await db
               .select({ id: pipelineRounds.id })
               .from(pipelineRounds)
               .where(eq(pipelineRounds.pipelineId, pipeline.id))
               .orderBy(pipelineRounds.order)
               .limit(1);

             if (firstRound) {
               await db.insert(candidateRounds).values({
                 candidateId: newCandidate[0].id,
                 roundId: firstRound.id,
                 status: "ACTIVE",
                 startedAt: new Date(),
               });
             }
           }
         } catch (enrollError) {
           // Pipeline enrollment failure should not block candidate creation
           console.error("Error enrolling candidate in pipeline:", enrollError);
         }

         // Trigger automated Resume Screening (fire-and-forget)
         // Screening failure must never block candidate creation
         try {
           const { completeScreeningRound } = await import("./candidate-pipeline");
           await completeScreeningRound({ candidateId: newCandidate[0].id });
         } catch (screeningError) {
           console.error("Error running automated resume screening:", screeningError);
         }
       }
    }

    revalidatePath("/dashboard");
    return { success: true, candidate: newCandidate[0] };
  } catch (error) {
    console.error("Error creating candidate:", error);
    return { success: false, error: "Failed to create candidate" };
  }
}

export async function getCandidates(jobId?: number) {
  const { userId } = await auth();
  
  if (!userId) {
    return [];
  }

  try {
    const whereClause = jobId
      ? and(eq(applicants.userId, userId), eq(applicants.targetJobId, jobId))
      : eq(applicants.userId, userId);

    const data = await db.select({
      id: applicants.id,
      name: applicants.name,
      email: applicants.email,
      phone: applicants.phone,
      status: applicants.status,
      score: applicants.score,
      matchScore: applicants.matchScore,
      jobTitle: applicants.jobTitle,
      targetJobId: applicants.targetJobId,
      scheduledAt: applicants.scheduledAt,
      createdAt: applicants.createdAt,
      linkedJobTitle: jobs.title,
    })
    .from(applicants)
    .leftJoin(jobs, eq(applicants.targetJobId, jobs.id))
    .where(whereClause);
    
    // Dynamically update status to 'Missed' if past scheduledAt and not completed
    const now = new Date();
    return data.map(c => {
      if (c.status !== "Completed" && c.scheduledAt && new Date(c.scheduledAt) < now) {
        return { ...c, status: "Missed" };
      }
      if (c.status === "Ready" && c.scheduledAt && new Date(c.scheduledAt) >= now) {
        return { ...c, status: "Scheduled" };
      }
      return c;
    });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    return [];
  }
}

export async function getCandidateById(id: number) {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const data = await db.select({
      id: applicants.id,
      name: applicants.name,
      jobTitle: applicants.jobTitle,
      targetJobId: applicants.targetJobId,
      linkedJobTitle: jobs.title,
    })
    .from(applicants)
    .leftJoin(jobs, eq(applicants.targetJobId, jobs.id))
    .where(eq(applicants.id, id))
    .limit(1);
    
    return data[0];
  } catch (error) {
    console.error("Error fetching candidate:", error);
    return null;
  }
}

export async function rescheduleCandidate(id: number, newDate: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const updated = await db.update(applicants)
      .set({ scheduledAt: new Date(newDate) })
      .where(and(eq(applicants.id, id), eq(applicants.userId, userId)))
      .returning({ id: applicants.id });

    if (updated.length === 0) {
      return { success: false, error: "Candidate not found or access denied" };
    }

    revalidatePath("/dashboard/schedules");
    return { success: true };
  } catch (error) {
    console.error("Error rescheduling candidate:", error);
    return { success: false };
  }
}

export async function updateCandidate(id: number, data: {
  name?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  targetJobId?: number;
  scheduledAt?: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    let finalJobTitle = data.jobTitle;

    // If a targetJobId is provided, sync the jobTitle text field with the actual job title
    if (data.targetJobId) {
      const jobData = await db.select({ title: jobs.title }).from(jobs).where(eq(jobs.id, data.targetJobId)).limit(1);
      if (jobData[0]) {
        finalJobTitle = jobData[0].title;
      }
    }

    const updated = await db.update(applicants)
      .set({
        ...data,
        jobTitle: finalJobTitle,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      })
      .where(and(eq(applicants.id, id), eq(applicants.userId, userId)))
      .returning({ id: applicants.id });

    if (updated.length === 0) {
      return { success: false, error: "Candidate not found or access denied" };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/candidates");
    revalidatePath("/dashboard/schedules");
    return { success: true };
  } catch (error) {
    console.error("Error updating candidate:", error);
    return { success: false };
  }
}
