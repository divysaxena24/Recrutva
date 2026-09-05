"use server";

import { db } from "@/db";
import { applicants } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function inviteCandidate(candidateId: number) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // In a real app, this would send an email/SMS
    // For now, we just update the status to "Calling" to simulate the AI agent taking over
    // Only the recruiter who owns the candidate may change their status
    const updated = await db.update(applicants)
      .set({ status: "Calling" })
      .where(and(eq(applicants.id, candidateId), eq(applicants.userId, userId)))
      .returning({ id: applicants.id });

    if (updated.length === 0) {
      return { success: false, error: "Candidate not found or access denied" };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Invite Error:", error);
    return { success: false };
  }
}
