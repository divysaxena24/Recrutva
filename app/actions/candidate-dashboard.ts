"use server";

import { db } from "@/db";
import { applicants, jobs } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function getCandidateApplications() {
  const user = await currentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }

  const userEmail = user.emailAddresses[0].emailAddress;

  const data = await db
    .select({
      id: applicants.id,
      jobTitle: applicants.jobTitle,
      status: applicants.status,
      createdAt: applicants.createdAt,
      scheduledAt: applicants.scheduledAt,
      score: applicants.score,
      jobId: applicants.targetJobId,
    })
    .from(applicants)
    .where(eq(applicants.email, userEmail))
    .orderBy(desc(applicants.createdAt));

  // Apply smart status logic (same as recruiter side)
  const now = new Date();
  return data.map(c => {
    if (c.status === "Completed") return c;
    if (c.scheduledAt && new Date(c.scheduledAt) < now) return { ...c, status: "Missed" };
    if (c.scheduledAt && new Date(c.scheduledAt) >= now) return { ...c, status: "Scheduled" };
    return { ...c, status: "Pending" };
  });
}
