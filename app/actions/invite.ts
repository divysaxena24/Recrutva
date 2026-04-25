"use server";

import { db } from "@/db";
import { applicants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function inviteCandidate(candidateId: number) {
  try {
    // In a real app, this would send an email/SMS
    // For now, we just update the status to "Calling" to simulate the AI agent taking over
    await db.update(applicants)
      .set({ status: "Calling" })
      .where(eq(applicants.id, candidateId));

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Invite Error:", error);
    return { success: false };
  }
}
