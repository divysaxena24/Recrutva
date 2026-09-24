import { z } from "zod";

/**
 * Validation for the AI Job Description workflow.
 *
 * Two boundaries are validated server-side:
 *   1. GenerateJobInputSchema — the recruiter's raw form input (untrusted,
 *      client-callable via a server action).
 *   2. GeneratedJDSchema      — the raw JSON returned by Groq (untrusted,
 *      may be malformed or contain extra fields).
 *
 * The normalized `JobDescription` type is what gets stored and edited.
 */

// ─── Enumerations ──────────────────────────────────────────────────

export const EmploymentTypeSchema = z.enum([
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
]);
export const EMPLOYMENT_TYPES = EmploymentTypeSchema.options;

export const WorkModeSchema = z.enum(["On-site", "Hybrid", "Remote"]);
export const WORK_MODES = WorkModeSchema.options;

// ─── Bounds ────────────────────────────────────────────────────────
// Bounded inputs keep the prompt size (and therefore token cost) predictable
// and stop a single request from sending a huge payload to Groq.
const BOUNDS = {
  title: 200,
  shortField: 100,
  freeText: 4000,
  skillChars: 80,
  maxSkills: 40,
  rawSkillEntries: 200,
  listItemChars: 400,
  maxListItems: 25,
  summaryChars: 4000,
  descriptionChars: 20000,
} as const;

// ─── Shared helpers ────────────────────────────────────────────────

/**
 * Normalize a list of strings: trim, drop blanks, collapse whitespace and
 * de-duplicate case-insensitively while preserving the original order.
 */
export function normalizeStringList(
  values: readonly string[],
  maxChars: number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const trimmed = cleaned.slice(0, maxChars);
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }

  return out;
}

const shortField = (label: string) =>
  z
    .preprocess(
      (val) => (val === null || val === undefined ? "" : String(val)),
      z.string().trim().max(BOUNDS.shortField, `${label} is too long`),
    )
    .optional()
    .default("");

const listItemSchema = z
  .string()
  .trim()
  .max(BOUNDS.listItemChars, "List item is too long");

// ─── 1. Recruiter input ────────────────────────────────────────────

export const GenerateJobInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Job title is required")
    .max(BOUNDS.title, "Job title is too long"),

  department: shortField("Department"),

  location: z
    .preprocess(
      (val) => (val === null || val === undefined ? "Remote" : String(val)),
      z.string().trim().max(BOUNDS.shortField, "Location is too long"),
    )
    .optional()
    .default("Remote"),

  employmentType: EmploymentTypeSchema,

  experience: z
    .preprocess(
      (val) => (val === null || val === undefined ? "" : String(val)),
      z.string().trim().max(BOUNDS.shortField, "Experience is too long"),
    )
    .optional()
    .default(""),

  // Key skills are the primary signal for downstream AI matching, so they are
  // required and normalized (trimmed, de-duplicated, count-capped).
  skills: z
    .array(z.string())
    .max(BOUNDS.rawSkillEntries, "Too many skill entries")
    .transform((values) => normalizeStringList(values, BOUNDS.skillChars))
    .refine((values) => values.length >= 1, "At least one key skill is required")
    .refine(
      (values) => values.length <= BOUNDS.maxSkills,
      `Please provide at most ${BOUNDS.maxSkills} key skills`,
    ),

  responsibilities: z
    .preprocess(
      (val) => (val === null || val === undefined ? "" : String(val)),
      z.string().trim().max(BOUNDS.freeText, "Responsibilities are too long"),
    )
    .optional()
    .default(""),

  additionalRequirements: z
    .preprocess(
      (val) => (val === null || val === undefined ? "" : String(val)),
      z.string().trim().max(BOUNDS.freeText, "Additional requirements are too long"),
    )
    .optional()
    .default(""),

  salaryRange: z
    .preprocess(
      (val) => (val === null || val === undefined ? "" : String(val)),
      z.string().trim().max(BOUNDS.shortField, "Salary range is too long"),
    )
    .optional()
    .default(""),

  workMode: WorkModeSchema.optional().default("Remote"),
});

export type GenerateJobInput = z.infer<typeof GenerateJobInputSchema>;

// ─── 2. Raw AI output ──────────────────────────────────────────────

/**
 * Schema for the JSON returned by Groq.
 *
 * Deliberately NOT `.strict()`: an LLM that adds an extra explanatory key
 * should not fail the whole generation (which would waste the tokens already
 * spent). Unknown keys are stripped, so whatever reaches the client is still
 * guaranteed to match this shape exactly.
 *
 * Lists may be empty — a sparse but valid response is still storable as a
 * draft; completeness is enforced when publishing instead.
 */
export const GeneratedJDSchema = z.object({
  title: z.string().trim().min(1, "AI returned no job title").max(BOUNDS.title),
  summary: z
    .string()
    .trim()
    .min(1, "AI returned no job overview")
    .max(BOUNDS.summaryChars, "AI job overview is too long"),
  responsibilities: z.array(listItemSchema).max(BOUNDS.maxListItems).default([]),
  requiredSkills: z.array(listItemSchema).max(BOUNDS.maxListItems).default([]),
  preferredSkills: z.array(listItemSchema).max(BOUNDS.maxListItems).default([]),
  qualifications: z.array(listItemSchema).max(BOUNDS.maxListItems).default([]),
  benefits: z.array(listItemSchema).max(BOUNDS.maxListItems).default([]),

  // Echoed by the model but NEVER trusted — the service overwrites these with
  // the recruiter's own input so nothing is fabricated.
  experience: z
    .preprocess(
      (val) => (val === null ? undefined : val),
      z.string().trim().max(BOUNDS.shortField).optional(),
    ),
  location: z
    .preprocess(
      (val) => (val === null ? undefined : val),
      z.string().trim().max(BOUNDS.shortField).optional(),
    ),
  employmentType: z
    .preprocess(
      (val) => (val === null ? undefined : val),
      z.string().trim().max(50).optional(),
    ),
  workMode: z
    .preprocess(
      (val) => (val === null ? undefined : val),
      z.string().trim().max(50).optional(),
    ),
});

export type GeneratedJDRaw = z.infer<typeof GeneratedJDSchema>;

// ─── 3. Normalized JD (stored + edited) ────────────────────────────

/**
 * The normalized Job Description. All fields are present; empty strings and
 * empty arrays are allowed so an in-progress draft can be saved, while
 * completeness is enforced at publish time.
 */
export const JobDescriptionSchema = z.object({
  title: z.string().trim().min(1, "Job title is required").max(BOUNDS.title),
  summary: z.string().trim().max(BOUNDS.summaryChars, "Job overview is too long"),
  responsibilities: z.array(listItemSchema).max(BOUNDS.maxListItems),
  requiredSkills: z.array(listItemSchema).max(BOUNDS.maxListItems),
  preferredSkills: z.array(listItemSchema).max(BOUNDS.maxListItems),
  qualifications: z.array(listItemSchema).max(BOUNDS.maxListItems),
  benefits: z.array(listItemSchema).max(BOUNDS.maxListItems),

  // Taken from the recruiter's input, never from the model.
  experience: z.string().trim().max(BOUNDS.shortField),
  location: z.string().trim().max(BOUNDS.shortField),
  employmentType: EmploymentTypeSchema,
  workMode: WorkModeSchema,
});

export type JobDescription = z.infer<typeof JobDescriptionSchema>;

// ─── 4. Save / publish payload ─────────────────────────────────────

export const JobPayloadSchema = z.object({
  /** Present when updating an existing draft rather than creating a new one. */
  jobId: z.number().int().positive().nullable().optional(),
  /** The recruiter's original input, stored so "Regenerate" always runs from source. */
  input: GenerateJobInputSchema,
  /** The generated/edited JD. */
  jd: JobDescriptionSchema,
});

export type JobPayload = z.infer<typeof JobPayloadSchema>;

/**
 * Completeness rules for publishing. Returning a message (rather than
 * throwing) keeps this usable from both the server action and the UI.
 */
export function validatePublishable(jd: JobDescription): string | null {
  if (!jd.title.trim()) return "Job title is required before publishing";
  if (!jd.summary.trim()) return "Add a job overview before publishing";
  if (jd.responsibilities.length === 0) {
    return "Add at least one responsibility before publishing";
  }
  if (jd.requiredSkills.length === 0) {
    return "Add at least one required skill before publishing";
  }
  return null;
}

export const MAX_DESCRIPTION_CHARS = BOUNDS.descriptionChars;
