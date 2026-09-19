"use server";

import { db } from "@/db";
import { applicants } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Returns an array of job IDs that the current Clerk user has already applied to.
 * Used by the public jobs page to show "Applied" / "Not Applied" badges.
 * 
 * Uses clerkUserId for primary lookup (stronger than email), falls back to
 * email for backward compatibility with existing applicants.
 */
export async function getAppliedJobIds(): Promise<number[]> {
  try {
    const { userId } = await auth();
    if (!userId) return [];

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    if (!email) return [];

    const rows = await db
      .select({ targetJobId: applicants.targetJobId })
      .from(applicants)
      .where(
        or(
          eq(applicants.clerkUserId, userId),
          eq(applicants.email, email)
        )
      )
      .execute();

    // Filter out nulls and return unique job IDs
    const ids = rows
      .map((r) => r.targetJobId)
      .filter((id): id is number => id !== null);

    return [...new Set(ids)];
  } catch (error) {
    console.error("Error fetching applied job IDs:", error);
    return [];
  }
}
