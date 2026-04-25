"use server";

import { db } from "@/db";
import { applicants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

export async function checkExistingApplication(jobId: number) {
  const user = await currentUser();
  if (!user) return null;

  const email = user.emailAddresses[0].emailAddress;

  const existing = await db
    .select()
    .from(applicants)
    .where(
      and(
        eq(applicants.email, email),
        eq(applicants.targetJobId, jobId)
      )
    )
    .limit(1);

  return existing[0] || null;
}
