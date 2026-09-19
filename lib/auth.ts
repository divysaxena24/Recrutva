import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, applicants, jobs, pipelines, pipelineRounds, candidateRounds } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────

export type AppUserRole = "RECRUITER" | "CANDIDATE";

export interface AppUser {
  id: number;
  clerkId: string;
  name: string;
  email: string;
  role: AppUserRole | null;
  createdAt: Date;
}

// ─── Core Auth Helpers ─────────────────────────────────────────────

/**
 * Get the current authenticated Clerk userId.
 * Returns null if not authenticated.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Require authentication. Returns the Clerk userId or throws/redirects.
 * For server actions / API routes: throws Error("Unauthorized").
 * For page routes: redirects to home.
 */
export async function requireAuth(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

/**
 * Require authentication for page routes — redirects to / if not authenticated.
 */
export async function requireAuthRedirect(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }
  return userId;
}

/**
 * Get the full application user from the database.
 * Creates a user record if one doesn't exist yet (first-time Clerk sign-in).
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  return getUserByClerkId(userId);
}

/**
 * Get a user by their Clerk ID.
 * Creates a user record if one doesn't exist (handles first sign-in).
 */
export async function getUserByClerkId(clerkId: string): Promise<AppUser | null> {
  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (existing) {
      return existing as AppUser;
    }

    // First-time sign-in: create user record from Clerk data
    const clerkUser = await currentUser();
    if (!clerkUser || clerkUser.id !== clerkId) return null;

    const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress;
    if (!primaryEmail) return null;

    const [created] = await db
      .insert(users)
      .values({
        clerkId,
        name: clerkUser.fullName || clerkUser.firstName || "User",
        email: primaryEmail,
      })
      .returning();

    return created as AppUser;
  } catch (error) {
    console.error("Error getting/creating user:", error);
    return null;
  }
}

/**
 * Require a specific application role.
 * For server actions / API routes: throws Error with appropriate message.
 */
export async function requireRole(role: AppUserRole): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (user.role !== role) {
    throw new Error(`Forbidden: requires ${role} role`);
  }
  return user;
}

/**
 * Require RECRUITER role.
 */
export async function requireRecruiter(): Promise<AppUser> {
  return requireRole("RECRUITER");
}

/**
 * Require CANDIDATE role.
 */
export async function requireCandidate(): Promise<AppUser> {
  return requireRole("CANDIDATE");
}

// ─── Resource Ownership Helpers ────────────────────────────────────

/**
 * Verify that a recruiter owns a specific job.
 * Returns the job if authorized, null otherwise.
 */
export async function requireJobOwner(
  jobId: number,
  userId: string
): Promise<{ id: number; userId: string; title: string } | null> {
  try {
    const [job] = await db
      .select({ id: jobs.id, userId: jobs.userId, title: jobs.title })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job || job.userId !== userId) {
      return null;
    }
    return job;
  } catch {
    return null;
  }
}

/**
 * Verify that a recruiter owns the candidate (applicant).
 * Returns the applicant if authorized, null otherwise.
 */
export async function requireCandidateOwner(
  candidateId: number,
  userId: string
): Promise<{ id: number; userId: string; targetJobId: number | null; email: string } | null> {
  try {
    const [applicant] = await db
      .select({
        id: applicants.id,
        userId: applicants.userId,
        targetJobId: applicants.targetJobId,
        email: applicants.email,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!applicant || applicant.userId !== userId) {
      return null;
    }
    return applicant;
  } catch {
    return null;
  }
}

/**
 * Verify that a recruiter owns the candidate round through the ownership chain:
 * candidateRound → pipelineRound → pipeline → job → userId
 */
export async function requireCandidateRoundAccess(
  candidateRoundId: number,
  userId: string
): Promise<{ candidateRoundId: number; candidateId: number } | null> {
  try {
    const [cr] = await db
      .select({
        id: candidateRounds.id,
        candidateId: candidateRounds.candidateId,
        roundId: candidateRounds.roundId,
      })
      .from(candidateRounds)
      .where(eq(candidateRounds.id, candidateRoundId))
      .limit(1);

    if (!cr) return null;

    const [pr] = await db
      .select({ pipelineId: pipelineRounds.pipelineId })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, cr.roundId))
      .limit(1);

    if (!pr) return null;

    const [pipeline] = await db
      .select({ jobId: pipelines.jobId })
      .from(pipelines)
      .where(eq(pipelines.id, pr.pipelineId))
      .limit(1);

    if (!pipeline) return null;

    const [job] = await db
      .select({ userId: jobs.userId })
      .from(jobs)
      .where(eq(jobs.id, pipeline.jobId))
      .limit(1);

    if (!job || job.userId !== userId) return null;

    return { candidateRoundId: cr.id, candidateId: cr.candidateId };
  } catch {
    return null;
  }
}

/**
 * Verify a candidate owns an assessment by checking the ownership chain:
 * candidate/applicant.clerkUserId → authenticated user
 * Falls back to email matching for backward compatibility.
 */
export async function requireAssessmentAccess(
  candidateId: number,
  clerkUserId: string,
  clerkEmail: string | null
): Promise<boolean> {
  try {
    const [applicant] = await db
      .select({
        id: applicants.id,
        userId: applicants.userId,
        clerkUserId: applicants.clerkUserId,
        email: applicants.email,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!applicant) return false;

    // Check: is this the recruiter who owns the candidate?
    if (applicant.userId === clerkUserId) return true;

    // Check: is this the candidate themselves?
    if (applicant.clerkUserId && applicant.clerkUserId === clerkUserId) return true;

    // Backward compatibility: email matching (for candidates without clerkUserId)
    if (clerkEmail && applicant.email === clerkEmail) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Verify a candidate owns an interview by checking the ownership chain.
 * Same logic as requireAssessmentAccess but for interview context.
 */
export async function requireInterviewAccess(
  candidateId: number,
  clerkUserId: string,
  clerkEmail: string | null
): Promise<boolean> {
  return requireAssessmentAccess(candidateId, clerkUserId, clerkEmail);
}
