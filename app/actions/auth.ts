"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

/**
 * Detect whether an error is a database *connectivity* problem (the database
 * could not be reached) as opposed to a query/schema/logic problem.
 *
 * The Neon HTTP driver attaches the underlying network failure as
 * `sourceError`; Postgres connection-class conditions use SQLSTATE class 08
 * plus 57P01/57P03.
 */
function isDatabaseUnavailable(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; current && depth < 6; depth++) {
    const candidate = current as {
      code?: unknown;
      sourceError?: unknown;
      cause?: unknown;
    };

    // Network-level failure (e.g. `TypeError: fetch failed`).
    if (candidate.sourceError) return true;

    if (typeof candidate.code === 'string') {
      const code = candidate.code;
      if (code.startsWith('08') || code === '57P01' || code === '57P03') {
        return true;
      }
    }

    current = candidate.cause;
  }

  return false;
}

/**
 * Log a database failure using only the deepest cause, so query text, bound
 * parameters and credentials never reach the logs.
 */
function logDatabaseError(context: string, error: unknown): void {
  let root: unknown = error;

  for (let depth = 0; root && depth < 6; depth++) {
    const candidate = root as { cause?: unknown; sourceError?: unknown };
    const next = candidate.sourceError ?? candidate.cause;
    if (!next) break;
    root = next;
  }

  const name = root instanceof Error ? root.name : typeof root;
  const message = root instanceof Error ? root.message : String(root);
  console.error(`[${context}] Database error (${name}): ${message}`);
}

/**
 * Set the application role for the current user during onboarding.
 * 
 * Security rules:
 * - Must be authenticated
 * - Role can only be set ONCE — subsequent calls are rejected
 * - Only RECRUITER or CANDIDATE are valid values
 * - This is a server-side operation — cannot be bypassed by client
 */
export async function setUserRole(role: "RECRUITER" | "CANDIDATE") {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  // Validate role
  if (role !== "RECRUITER" && role !== "CANDIDATE") {
    return { success: false, error: "Invalid role" };
  }

  try {
    // Check if user already has a role set
    const [existing] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (existing && existing.role) {
      // Role already set — do not allow changes via onboarding
      return {
        success: false,
        error: "Role already set. Contact support to change your role.",
        redirectPath: existing.role === "RECRUITER" ? "/dashboard" : "/candidate-dashboard",
      };
    }

    // Get Clerk user data for creating the user record if needed
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return { success: false, error: "User data not available" };
    }

    const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress;
    if (!primaryEmail) {
      return { success: false, error: "Email not available" };
    }

    if (existing) {
      // Update existing user with role
      await db
        .update(users)
        .set({ role })
        .where(eq(users.clerkId, userId));
    } else {
      // Create new user with role
      await db.insert(users).values({
        clerkId: userId,
        name: clerkUser.fullName || clerkUser.firstName || "User",
        email: primaryEmail,
        role,
      });
    }

    revalidatePath("/onboarding");
    revalidatePath("/dashboard");
    revalidatePath("/candidate-dashboard");

    return {
      success: true,
      redirectPath: role === "RECRUITER" ? "/dashboard" : "/candidate-dashboard",
    };
  } catch (error) {
    // Surface the failure instead of pretending the role was saved. The
    // onboarding page renders `error` and does NOT redirect when it is set.
    logDatabaseError("setUserRole", error);
    return {
      success: false,
      error: isDatabaseUnavailable(error)
        ? "We couldn't reach the database right now. Please try again in a moment."
        : "We couldn't save your role. Please try again.",
    };
  }
}

/**
 * Get the current user's role.
 * Returns null if not authenticated or no role set.
 */
export async function getUserRole(): Promise<"RECRUITER" | "CANDIDATE" | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const [existing] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    return existing?.role ?? null;
  } catch {
    return null;
  }
}
