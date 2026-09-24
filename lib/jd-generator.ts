import { groq, AI_MODELS } from "@/lib/ai";
import {
  GeneratedJDSchema,
  GenerateJobInputSchema,
  normalizeStringList,
  type GenerateJobInput,
  type GeneratedJDRaw,
  type JobDescription,
  MAX_DESCRIPTION_CHARS,
} from "@/lib/schemas/jd";

/**
 * AI Job Description generation.
 *
 * Mirrors the structure of lib/screening.ts: build a prompt, call the shared
 * Groq client, parse JSON (tolerating code fences), then validate with Zod
 * before anything reaches the database or the client.
 *
 * No automatic model retries are performed — a retry would spend tokens
 * without the user asking for it. Failures are surfaced to the caller so the
 * recruiter can decide whether to try again.
 */

// ─── Result types ──────────────────────────────────────────────────

export type JDGenerationErrorCode =
  | "rate_limit"
  | "timeout"
  | "malformed"
  | "empty"
  | "invalid_input"
  | "unavailable";

export interface JDGenerationSuccess {
  success: true;
  jd: JobDescription;
}

export interface JDGenerationFailure {
  success: false;
  code: JDGenerationErrorCode;
  /** Safe, user-facing message — never contains provider internals. */
  error: string;
}

export type JDGenerationResult = JDGenerationSuccess | JDGenerationFailure;

const MAX_TOKENS = 800;
const TEMPERATURE = 0.4;

// ─── Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional technical recruiter and job-description writer.

Write a clear, realistic, well-organised job description using ONLY the information the recruiter supplies. You may organise, clarify and phrase that information professionally, but you must not add facts of your own.

Hard rules:
- Do NOT invent company facts, products, funding, team size, culture claims or mission statements.
- Do NOT invent compensation or salary figures.
- Do NOT invent benefits specific to a company (equity, specific perks, specific insurance). Only include general, role-appropriate benefits, and mark them as typical rather than promised.
- Do NOT invent certifications, technologies, tools, years of experience or qualifications that the recruiter did not supply.
- Do NOT add requirements that could discriminate on the basis of age, gender, marital status, nationality, religion, disability, or any other protected characteristic.
- Avoid buzzwords and generic filler ("rockstar", "ninja", "fast-paced environment", "wear many hats").
- Responsibilities must be concrete and actionable.
- Keep required and preferred skills clearly separated: anything the recruiter listed as a key skill is REQUIRED. Only move a skill to preferred if the recruiter indicated it is optional.
- Keep terminology consistent with the supplied role title.
- Write for a candidate: prioritise clarity over salesmanship.

Output contract:
- Respond with a single valid JSON object and nothing else.
- No markdown, no code fences, no commentary before or after the JSON.
- Every list must be an array of plain strings (no nested objects, no numbering prefixes).
- Never return null for "summary", "responsibilities" or "requiredSkills" — use an empty array where nothing is known.
- "experience", "location", "employmentType" and "workMode" must echo the recruiter's supplied values verbatim, or null when the recruiter did not supply them. Never guess these.

JSON shape:
{
  "title": string,
  "summary": string,
  "responsibilities": string[],
  "requiredSkills": string[],
  "preferredSkills": string[],
  "qualifications": string[],
  "benefits": string[],
  "experience": string | null,
  "location": string | null,
  "employmentType": string | null,
  "workMode": string | null
}`;

/**
 * Build the user message describing the role. Exported for tests so the
 * prompt contract can be asserted without calling Groq.
 */
export function buildJDPrompt(input: GenerateJobInput): string {
  const lines: string[] = [
    "Create a job description for the following role.",
    "",
    `Job Title: ${input.title}`,
    `Employment Type: ${input.employmentType}`,
  ];

  if (input.department) lines.push(`Department: ${input.department}`);
  if (input.location) lines.push(`Location: ${input.location}`);
  if (input.workMode) lines.push(`Work Mode: ${input.workMode}`);
  if (input.experience) lines.push(`Experience: ${input.experience}`);
  if (input.salaryRange) lines.push(`Salary Range: ${input.salaryRange}`);

  lines.push(
    "",
    `Key Skills (REQUIRED): ${input.skills.join(", ")}`,
  );

  if (input.responsibilities) {
    lines.push("", "Responsibilities / Notes from the recruiter:", input.responsibilities);
  }
  if (input.additionalRequirements) {
    lines.push("", "Additional Requirements from the recruiter:", input.additionalRequirements);
  }

  lines.push(
    "",
    "Write the job overview, responsibilities, required skills, preferred skills, qualifications and general benefits for this role.",
    input.salaryRange
      ? "You may state the supplied salary range verbatim, but do not add any other compensation detail."
      : "Do not state or invent any salary figures.",
    input.experience
      ? "You may reference the supplied experience range, but do not invent extra years."
      : "Do not invent years of experience.",
  );

  return lines.join("\n");
}

// ─── Response recovery ─────────────────────────────────────────────

/**
 * Recover a list of strings from a model response that may be sloppy.
 *
 * Accepts a real array, or a single string in which each line is a bullet
 * ("- ", "• ", "* ") or a numbered item ("1. "). Blank entries are dropped.
 * This is the recovery step for LLM output — it runs before Zod validation
 * so a slightly-off but usable response is not thrown away.
 */
export function coerceStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map((item) => (typeof item === "string" ? item : String(item)));
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ""))
      .filter((line) => line.trim().length > 0);
  }

  if (value === null || value === undefined) return [];

  return [];
}

/** Apply list recovery across every list field of a raw AI response. */
function coerceGeneratedJD(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;

  const source = value as Record<string, unknown>;
  return {
    ...source,
    responsibilities: coerceStringList(source.responsibilities),
    requiredSkills: coerceStringList(source.requiredSkills),
    preferredSkills: coerceStringList(source.preferredSkills),
    qualifications: coerceStringList(source.qualifications),
    benefits: coerceStringList(source.benefits),
  };
}

/** Strip markdown code fences that models sometimes wrap JSON in. */
function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

// ─── Normalization ─────────────────────────────────────────────────

/**
 * Combine the validated AI sections with the recruiter's authoritative input.
 *
 * `experience`, `location`, `employmentType`, `workMode` and `title` are
 * taken from the input, never from the model, so nothing can be fabricated.
 * Exported for tests.
 */
export function normalizeGeneratedJD(
  raw: GeneratedJDRaw,
  input: GenerateJobInput,
): JobDescription {
  return {
    title: input.title,
    summary: raw.summary,
    responsibilities: normalizeStringList(raw.responsibilities, 400),
    requiredSkills: normalizeStringList(
      raw.requiredSkills.length > 0 ? raw.requiredSkills : input.skills,
      400,
    ),
    preferredSkills: normalizeStringList(raw.preferredSkills, 400),
    qualifications: normalizeStringList(raw.qualifications, 400),
    benefits: normalizeStringList(raw.benefits, 400),
    experience: input.experience,
    location: input.location,
    employmentType: input.employmentType,
    workMode: input.workMode,
  };
}

/**
 * Render the structured JD into the plain-text `jobs.description` column so
 * existing consumers (public listing, resume screening) keep working.
 * Exported for tests.
 */
export function composeJobDescription(
  jd: JobDescription,
  meta?: { department?: string; salaryRange?: string },
): string {
  const sections: string[] = [];

  if (jd.summary) sections.push(jd.summary);

  const list = (title: string, items: string[]) => {
    if (items.length === 0) return;
    sections.push(`${title}\n${items.map((item) => `- ${item}`).join("\n")}`);
  };

  list("Responsibilities", jd.responsibilities);
  list("Required Skills", jd.requiredSkills);
  list("Preferred Skills", jd.preferredSkills);
  list("Qualifications", jd.qualifications);
  list("Benefits", jd.benefits);

  const facts: string[] = [];
  if (meta?.department) facts.push(`Department: ${meta.department}`);
  if (jd.experience) facts.push(`Experience: ${jd.experience}`);
  if (jd.location) facts.push(`Location: ${jd.location}`);
  if (jd.employmentType) facts.push(`Employment Type: ${jd.employmentType}`);
  if (jd.workMode) facts.push(`Work Mode: ${jd.workMode}`);
  if (meta?.salaryRange) facts.push(`Salary Range: ${meta.salaryRange}`);
  if (facts.length > 0) sections.push(facts.join("\n"));

  return sections.join("\n\n").slice(0, MAX_DESCRIPTION_CHARS);
}

// ─── Error classification ──────────────────────────────────────────

/**
 * Map a thrown Groq error onto a code and a safe user-facing message.
 * Internal provider details stay in the server log, never in the response.
 */
export function classifyGroqError(error: unknown): JDGenerationFailure {
  const anyError = error as {
    status?: unknown;
    code?: unknown;
    name?: unknown;
    message?: unknown;
    error?: { code?: unknown; message?: unknown };
  };

  const status = typeof anyError?.status === "number" ? anyError.status : undefined;
  const code = typeof anyError?.error?.code === "string" ? anyError.error.code : "";
  const name = typeof anyError?.name === "string" ? anyError.name : "";
  const message = typeof anyError?.message === "string" ? anyError.message : "";
  const haystack = `${name} ${code} ${message}`.toLowerCase();

  if (status === 429 || haystack.includes("rate limit") || haystack.includes("rate_limit")) {
    return {
      success: false,
      code: "rate_limit",
      error: "The AI service is busy right now. Please wait a moment and try again.",
    };
  }

  if (
    status === 408 ||
    haystack.includes("timeout") ||
    haystack.includes("timed out") ||
    haystack.includes("etimedout") ||
    haystack.includes("econnreset")
  ) {
    return {
      success: false,
      code: "timeout",
      error: "The AI service took too long to respond. Please try again.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      success: false,
      code: "unavailable",
      error: "AI generation is temporarily unavailable. Please try again later.",
    };
  }

  return {
    success: false,
    code: "unavailable",
    error: "AI generation failed. Please try again.",
  };
}

function logGenerationFailure(
  code: JDGenerationErrorCode,
  details: Record<string, unknown>,
): void {
  console.error("[JDGenerator] Generation failed", {
    feature: "job-description-generation",
    model: AI_MODELS.jobGeneration,
    code,
    ...details,
  });
}

// ─── Main entry point ──────────────────────────────────────────────

export async function generateJobDescription(
  rawInput: unknown,
): Promise<JDGenerationResult> {
  // 1. Validate the recruiter's input server-side (never trust the client).
  const parsedInput = GenerateJobInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return {
      success: false,
      code: "invalid_input",
      error: parsedInput.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const input = parsedInput.data;

  const prompt = buildJDPrompt(input);

  let rawResponse: string | undefined;
  try {
    // 2. Call the shared Groq client (no locally-created client).
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      model: AI_MODELS.jobGeneration,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      response_format: { type: "json_object" },
    });

    rawResponse = chatCompletion.choices[0]?.message?.content ?? undefined;
  } catch (error) {
    const failure = classifyGroqError(error);
    logGenerationFailure(failure.code, {
      promptSizeBytes: Buffer.byteLength(prompt, "utf8"),
      error: error instanceof Error ? error.message : String(error),
    });
    return failure;
  }

  // 3-5. Parse, validate and normalize the model response.
  return parseGeneratedJDResponse(rawResponse ?? "", input);
}

/**
 * Turn a raw model response into a normalized JobDescription.
 *
 * Steps 3-5 of the pipeline (parse JSON → recover list shapes → Zod validate
 * → normalize). Exported so the malformed/empty/AI-shape branches can be
 * exercised without spending tokens on a live Groq call.
 */
export function parseGeneratedJDResponse(
  rawResponse: string,
  input: GenerateJobInput,
): JDGenerationResult {
  const promptSizeBytes = 0;

  if (!rawResponse || !rawResponse.trim()) {
    logGenerationFailure("empty", { promptSizeBytes });
    return {
      success: false,
      code: "empty",
      error: "The AI returned an empty response. Please try again.",
    };
  }

  // Parse JSON, tolerating markdown code fences.
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripCodeFences(rawResponse));
  } catch {
    logGenerationFailure("malformed", {
      promptSizeBytes,
      rawResponsePreview: rawResponse.slice(0, 300),
    });
    return {
      success: false,
      code: "malformed",
      error: "The AI returned an unreadable response. Please try again.",
    };
  }

  // Recover sloppy list shapes, then validate with Zod.
  const validation = GeneratedJDSchema.safeParse(coerceGeneratedJD(parsedJson));
  if (!validation.success) {
    logGenerationFailure("malformed", {
      promptSizeBytes,
      issues: validation.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return {
      success: false,
      code: "malformed",
      error: "The AI response did not match the expected format. Please try again.",
    };
  }

  // Normalize — recruiter input wins for factual fields.
  return { success: true, jd: normalizeGeneratedJD(validation.data, input) };
}
