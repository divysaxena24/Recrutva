"use server";

import { db } from "@/db";
import { applicants, jobs } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

export async function createCandidate(data: {
  name: string;
  email: string;
  phone: string;
  resumeText: string;
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
      status: "Ready",
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    }).returning();

    // Trigger AI Matching in the background (or await if you want immediate feedback)
    if (newCandidate[0].id) {
       const { calculateMatchScore } = await import("./matching");
       await calculateMatchScore(newCandidate[0].id);
    }

    revalidatePath("/dashboard");
    return { success: true, candidate: newCandidate[0] };
  } catch (error) {
    console.error("Error creating candidate:", error);
    return { success: false, error: "Failed to create candidate" };
  }
}

export async function getCandidates() {
  const { userId } = await auth();
  
  if (!userId) {
    return [];
  }

  try {
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
    .where(eq(applicants.userId, userId));
    
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
    await db.update(applicants)
      .set({ scheduledAt: new Date(newDate) })
      .where(eq(applicants.id, id));

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

    await db.update(applicants)
      .set({
        ...data,
        jobTitle: finalJobTitle,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      })
      .where(eq(applicants.id, id));

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/candidates");
    revalidatePath("/dashboard/schedules");
    return { success: true };
  } catch (error) {
    console.error("Error updating candidate:", error);
    return { success: false };
  }
}
