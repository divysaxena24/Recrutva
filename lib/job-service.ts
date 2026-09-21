import "server-only";

import { db } from "@/db";
import { jobs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cacheDelete, CACHE_KEYS } from "@/lib/cache";
import { composeJobDescription } from "@/lib/jd-generator";
import {
  GenerateJobInputSchema,
  JobPayloadSchema,
  validatePublishable,
  type GenerateJobInput,
  type JobDescription,
  type JobPayload,
} from "@/lib/schemas/jd";

/**
 * Persistence for the AI Job Description workflow.
 *
 * Deliberately free of Clerk/Next imports: authorization happens in
 * app/actions/jd.ts and the owner's user id is passed in here, which keeps
 * this module runnable from host-side regression scripts.
 *
 * Every write is scoped to `userId`, so a recruiter can never read or
 * overwrite another recruiter's job even if they guess its id.
 */

export type JobWriteStatus = "DRAFT" | "PUBLISHED";

export interface JobWriteSuccess {
  success: true;
  jobId: number;
  status: JobWriteStatus;
  created: boolean;
}

export interface JobWriteFailure {
  success: false;
  code: "invalid" | "not_found" | "forbidden" | "incomplete" | "db_error";
  error: string;
}

export type JobWriteResult = JobWriteSuccess | JobWriteFailure;

/**
 * Walk the error chain (both `cause` and the Neon driver's `sourceError`) and
 * return the deepest message, so logs show the real reason a write failed
 * without dumping the query text or bound parameters.
 */
function rootErrorMessage(error: unknown): string {
  let current: unknown = error;
  let deepest = error instanceof Error ? error.message : String(error);

  for (let depth = 0; current && depth < 6; depth++) {
    const candidate = current as { cause?: unknown; sourceError?: unknown; message?: unknown };
    if (typeof candidate.message === "string") deepest = candidate.message;
    const next = candidate.sourceError ?? candidate.cause;
    if (!next) break;
    current = next;
  }

  return deepest;
}

/** Row shape returned to the editor so an existing draft can be reopened. */
export interface EditableJob {
  id: number;
  status: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  experience: string;
  workMode: string;
  salaryRange: string;
  summary: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  qualifications: string[];
  benefits: string[];
  /** The recruiter's original form input, when this job came from the AI workflow. */
  sourceInput: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Column mapping ────────────────────────────────────────────────

/**
 * Map a validated payload onto `jobs` columns.
 *
 * `description` keeps holding the rendered plain text so existing consumers
 * (public listing, resume screening) continue to work unchanged, while the
 * structured sections are stored alongside it.
 */
function toJobColumns(
  userId: string,
  payload: JobPayload,
  status: JobWriteStatus,
) {
  const { input, jd } = payload;

  const description =
    composeJobDescription(jd, {
      department: input.department || undefined,
      salaryRange: input.salaryRange || undefined,
    }) || jd.title;

  return {
    userId,
    title: jd.title,
    description,
    // `requirements` stays the recruiter's extra requirements; the individual
    // skill lists live in their own columns (and inside `description`).
    requirements: input.additionalRequirements || null,
    location: jd.location || input.location || "Remote",
    status,
    department: input.department || null,
    employmentType: jd.employmentType,
    experience: jd.experience || null,
    workMode: jd.workMode,
    salaryRange: input.salaryRange || null,
    summary: jd.summary || null,
    responsibilities: jd.responsibilities,
    requiredSkills: jd.requiredSkills,
    preferredSkills: jd.preferredSkills,
    qualifications: jd.qualifications,
    benefits: jd.benefits,
    sourceInput: input as unknown as Record<string, unknown>,
    updatedAt: new Date(),
  };
}

// ─── Writes ────────────────────────────────────────────────────────

/**
 * Create or update a job for `userId`.
 *
 * When `jobId` is supplied the existing row is updated in place — a draft
 * that was already saved is never duplicated. Ownership is checked first.
 */
export async function upsertJob(
  userId: string,
  rawPayload: unknown,
  status: JobWriteStatus,
): Promise<JobWriteResult> {
  const parsed = JobPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      success: false,
      code: "invalid",
      error: parsed.error.issues[0]?.message ?? "Invalid job data",
    };
  }
  const payload = parsed.data;

  if (status === "PUBLISHED") {
    const incomplete = validatePublishable(payload.jd);
    if (incomplete) {
      return { success: false, code: "incomplete", error: incomplete };
    }
  }

  const columns = toJobColumns(userId, payload, status);

  try {
    let jobId: number;
    let created: boolean;

    if (payload.jobId) {
      // Ownership is checked BEFORE writing — updating first and validating
      // afterwards would already have reassigned the row to the caller.
      const existing = await db
        .select({ userId: jobs.userId })
        .from(jobs)
        .where(eq(jobs.id, payload.jobId))
        .limit(1);

      const owner = existing[0];
      if (!owner) {
        return { success: false, code: "not_found", error: "Job not found" };
      }
      if (owner.userId !== userId) {
        return {
          success: false,
          code: "forbidden",
          error: "You do not have access to this job",
        };
      }

      // The predicate repeats the owner check as defence in depth.
      await db
        .update(jobs)
        .set(columns)
        .where(and(eq(jobs.id, payload.jobId), eq(jobs.userId, userId)));

      jobId = payload.jobId;
      created = false;
    } else {
      const inserted = await db
        .insert(jobs)
        .values(columns)
        .returning({ id: jobs.id });

      jobId = inserted[0].id;
      created = true;
    }

    // Cache invalidation is best-effort — never fail the write for it.
    try {
      const keys = [CACHE_KEYS.job(jobId), CACHE_KEYS.jobList(userId)];
      if (status === "PUBLISHED") keys.push(CACHE_KEYS.allJobs());
      await cacheDelete(...keys);
    } catch {
      // ignore
    }

    return { success: true, jobId, status, created };
  } catch (error) {
    console.error("[JobService] Failed to persist job", {
      userId,
      jobId: payload.jobId ?? null,
      status,
      cause: rootErrorMessage(error),
    });
    return {
      success: false,
      code: "db_error",
      error: "We couldn't save this job right now. Please try again.",
    };
  }
}

// ─── Reads ─────────────────────────────────────────────────────────

/**
 * Load a job for editing, scoped to its owner.
 * Returns null when the job does not exist or belongs to someone else.
 */
export async function getOwnedJobForEditing(
  userId: string,
  jobId: number,
): Promise<EditableJob | null> {
  try {
    const rows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    const job = rows[0];
    if (!job || job.userId !== userId) return null;

    return {
      id: job.id,
      status: job.status,
      title: job.title,
      department: job.department ?? "",
      location: job.location ?? "",
      employmentType: job.employmentType ?? "",
      experience: job.experience ?? "",
      workMode: job.workMode ?? "",
      salaryRange: job.salaryRange ?? "",
      summary: job.summary ?? "",
      responsibilities: job.responsibilities ?? [],
      requiredSkills: job.requiredSkills ?? [],
      preferredSkills: job.preferredSkills ?? [],
      qualifications: job.qualifications ?? [],
      benefits: job.benefits ?? [],
      sourceInput: job.sourceInput ?? null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  } catch (error) {
    console.error("[JobService] Failed to load job for editing", {
      userId,
      jobId,
      cause: rootErrorMessage(error),
    });
    return null;
  }
}

/**
 * Rebuild the recruiter's original form input for `GenerateJobInputSchema`.
 *
 * Uses the stored `sourceInput` where present, so "Regenerate" always runs
 * from the recruiter's own requirements rather than previously generated or
 * edited text. Legacy jobs (created before this workflow) fall back to their
 * columns.
 */
export function toGenerateJobInput(
  job: EditableJob,
  storedSourceInput: unknown,
): GenerateJobInput | null {
  const stored = GenerateJobInputSchema.safeParse(storedSourceInput);
  if (stored.success) return stored.data;

  const fallback = {
    title: job.title,
    department: job.department,
    location: job.location || "Remote",
    employmentType: job.employmentType || "Full-time",
    experience: job.experience,
    skills: job.requiredSkills.length > 0 ? job.requiredSkills : [job.title],
    responsibilities: job.summary || "",
    additionalRequirements: "",
    salaryRange: job.salaryRange,
    workMode: job.workMode || "Remote",
  };

  const fallbackParsed = GenerateJobInputSchema.safeParse(fallback);
  return fallbackParsed.success ? fallbackParsed.data : null;
}

/** Convenience re-export so callers can render a JD without a second import. */
export type { GenerateJobInput, JobDescription };
