"use server";

import { db } from "@/db";
import { applicants } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function checkExistingApplication(jobId: number) {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!email) return null;

  const existing = await db
    .select()
    .from(applicants)
    .where(
      and(
        or(
          eq(applicants.clerkUserId, userId),
          eq(applicants.email, email)
        ),
        eq(applicants.targetJobId, jobId)
      )
    )
    .limit(1);

  return existing[0] || null;
}
