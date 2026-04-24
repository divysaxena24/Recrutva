"use server";

import { db } from "@/db";
import { candidates } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

export async function createCandidate(data: {
  name: string;
  email: string;
  phone: string;
  resumeText: string;
}) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const newCandidate = await db.insert(candidates).values({
      userId: userId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      resumeText: data.resumeText,
      status: "Ready",
    }).returning();

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
    return await db.select().from(candidates).where(require('drizzle-orm').eq(candidates.userId, userId));
  } catch (error) {
    console.error("Error fetching candidates:", error);
    return [];
  }
}
