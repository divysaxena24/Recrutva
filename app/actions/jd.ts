"use server";

import { revalidatePath } from "next/cache";
import { requireRecruiter } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateJobDescription } from "@/lib/jd-generator";
import {
  getOwnedJobForEditing,
  toGenerateJobInput,
  upsertJob,
  type EditableJob,
} from "@/lib/job-service";
import type { GenerateJobInput, JobDescription } from "@/lib/schemas/jd";

/**
 * Server actions for the AI Job Description workflow.
 *
 * Authorization is enforced here, on the server, before any AI call or
 * database write — the client is never trusted to decide what a recruiter
 * may do. Generation and publishing are deliberately separate operations:
 * generating a JD never publishes (or even persists) a job.
 *
 * All failures return `{ success: false, error }` with a safe message; no
 * stack traces, provider internals or database errors are exposed.
 */

type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "rate_limited"
  | "invalid_input"
  | "incomplete"
  | "not_found"
  | "malformed"
  | "timeout"
  | "empty"
  | "unavailable"
  | "db_error";

interface ActionFailure {
  success: false;
  code: ErrorCode;
  error: string;
}

// ─── Authorization ─────────────────────────────────────────────────

type RecruiterResolution =
  | { ok: true; userId: string }
  | { ok: false; failure: ActionFailure };

/**
 * Resolve the authenticated hiring manager.
 * Reuses the shared role guard in lib/auth.ts rather than re-implementing it.
 */
async function resolveRecruiter(): Promise<RecruiterResolution> {
  try {
    const user = await requireRecruiter();
    return { ok: true, userId: user.clerkId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.startsWith("Forbidden")) {
      return {
        ok: false,
        failure: {
          success: false,
          code: "forbidden",
          error: "Only hiring managers can use the AI job description builder.",
        },
      };
    }

    return {
      ok: false,
      failure: {
        success: false,
        code: "unauthenticated",
        error: "Please sign in again to continue.",
      },
    };
  }
}

/**
 * Apply the shared rate limiter to the expensive Groq call.
 * Fails open when Redis is not configured, matching the rest of the app.
 */
async function checkGenerationQuota(userId: string): Promise<ActionFailure | null> {
  try {
    const result = await rateLimit(
      { endpoint: "ai-generate-jd", limit: 10, windowSeconds: 600 },
      `user:${userId}`,
    );

    if (result.success) return null;

    return {
      success: false,
      code: "rate_limited",
      error: "You've generated a lot of job descriptions recently. Please try again shortly.",
    };
  } catch {
    // Rate limiting must never block a legitimate request.
    return null;
  }
}

// ─── Generate ──────────────────────────────────────────────────────

export type GenerateJDResult =
  | { success: true; jd: JobDescription }
  | ActionFailure;

/**
 * Generate a job description from the recruiter's input.
 *
 * Nothing is persisted here — the recruiter reviews and edits the result
 * first, then explicitly saves a draft or publishes.
 */
export async function generateJobDraft(
  rawInput: unknown,
): Promise<GenerateJDResult> {
  const recruiter = await resolveRecruiter();
  if (!recruiter.ok) return recruiter.failure;

  const quota = await checkGenerationQuota(recruiter.userId);
  if (quota) return quota;

  const result = await generateJobDescription(rawInput);
  if (!result.success) {
    return { success: false, code: result.code as ErrorCode, error: result.error };
  }

  return { success: true, jd: result.jd };
}

// ─── Save draft / publish ──────────────────────────────────────────

export type SaveJobResult =
  | { success: true; jobId: number; status: "DRAFT" | "PUBLISHED" }
  | ActionFailure;

/** Save the reviewed JD as a DRAFT. Updating an existing job never duplicates it. */
export async function saveJobDraft(payload: unknown): Promise<SaveJobResult> {
  const recruiter = await resolveRecruiter();
  if (!recruiter.ok) return recruiter.failure;

  const result = await upsertJob(recruiter.userId, payload, "DRAFT");
  if (!result.success) {
    return {
      success: false,
      code: result.code === "invalid" ? "invalid_input" : result.code,
      error: result.error,
    };
  }

  revalidatePath("/dashboard/jobs");
  return { success: true, jobId: result.jobId, status: result.status };
}

/** Publish the reviewed JD so it appears in the public job listing. */
export async function publishJob(payload: unknown): Promise<SaveJobResult> {
  const recruiter = await resolveRecruiter();
  if (!recruiter.ok) return recruiter.failure;

  const result = await upsertJob(recruiter.userId, payload, "PUBLISHED");
  if (!result.success) {
    return {
      success: false,
      code: result.code === "invalid" ? "invalid_input" : result.code,
      error: result.error,
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${result.jobId}`);
  return { success: true, jobId: result.jobId, status: result.status };
}

// ─── Reopen an existing job ────────────────────────────────────────

export type LoadJobResult =
  | { success: true; job: EditableJob; input: GenerateJobInput | null }
  | ActionFailure;

/**
 * Load one of the caller's own jobs so a draft can be reopened and edited.
 * Ownership failures are reported as "not found" so ids cannot be probed.
 */
export async function getJobForEditing(jobId: number): Promise<LoadJobResult> {
  const recruiter = await resolveRecruiter();
  if (!recruiter.ok) return recruiter.failure;

  if (!Number.isInteger(jobId) || jobId <= 0) {
    return { success: false, code: "not_found", error: "Job not found" };
  }

  const job = await getOwnedJobForEditing(recruiter.userId, jobId);
  if (!job) {
    return { success: false, code: "not_found", error: "Job not found" };
  }

  return { success: true, job, input: toGenerateJobInput(job, job.sourceInput) };
}
