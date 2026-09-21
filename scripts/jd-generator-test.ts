/**
 * AI Job Description Generator — verification tests.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json scripts/jd-generator-test.ts
 *
 * Covers:
 *   A. Recruiter input validation (required fields, bounds, normalization)
 *   B. Prompt contract
 *   C. AI response handling (valid, code-fenced, sloppy lists, extra keys,
 *      malformed JSON, empty response)
 *   D. Groq error classification (rate limit, timeout, auth)
 *   E. Normalization — the recruiter's input always wins over the model
 *   F. Description composition for the existing `jobs.description` column
 *   G. Publish completeness rules
 *   H. Rate limiter fail-open behaviour
 *   I. Database persistence: draft, update-without-duplication, publish,
 *      public visibility, ownership isolation
 *   J. Live Groq generation (skipped with SKIP_LIVE_AI=1)
 *
 * Section I writes real rows to the configured database and deletes them
 * again before exiting.
 */

import { config } from "dotenv";
config({ path: ".env" });

import { db } from "@/db";
import { jobs, PUBLIC_JOB_STATUSES } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  GenerateJobInputSchema,
  validatePublishable,
  normalizeStringList,
  type GenerateJobInput,
  type JobDescription,
} from "@/lib/schemas/jd";
import {
  buildJDPrompt,
  classifyGroqError,
  coerceStringList,
  composeJobDescription,
  generateJobDescription,
  normalizeGeneratedJD,
  parseGeneratedJDResponse,
} from "@/lib/jd-generator";
import {
  getOwnedJobForEditing,
  toGenerateJobInput,
  upsertJob,
} from "@/lib/job-service";
import { rateLimit } from "@/lib/rate-limit";

// ─── Test harness ──────────────────────────────────────────────────

const results: { section: string; t: string; s: "PASS" | "FAIL" }[] = [];

function log(section: string, t: string, ok: boolean, d = "") {
  results.push({ section, t, s: ok ? "PASS" : "FAIL" });
  console.log(`${ok ? "✅" : "❌"} [${section}] ${t}${d ? `: ${d}` : ""}`);
}

function section(name: string) {
  console.log("\n" + "─".repeat(70));
  console.log(`  ${name}`);
  console.log("─".repeat(70));
}

/** Run expected-failure assertions without polluting output with error logs. */
async function expectFailure<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

// ─── Fixtures ──────────────────────────────────────────────────────

const RECRUITER_A = "user_jd_test_recruiter_a";
const RECRUITER_B = "user_jd_test_recruiter_b";

const VALID_INPUT = {
  title: "Backend Engineer",
  department: "Engineering",
  location: "Bangalore, India",
  employmentType: "Full-time",
  experience: "2-4 years",
  skills: ["Java", "Spring Boot", "PostgreSQL", "REST APIs"],
  responsibilities: "Own the payments service.",
  additionalRequirements: "Comfortable with on-call rotation.",
  salaryRange: "12-18 LPA",
  workMode: "Hybrid",
};

function parsedInput(overrides: Record<string, unknown> = {}): GenerateJobInput {
  const result = GenerateJobInputSchema.safeParse({ ...VALID_INPUT, ...overrides });
  if (!result.success) throw new Error("fixture input is invalid");
  return result.data;
}

function makeJd(overrides: Partial<JobDescription> = {}): JobDescription {
  const input = parsedInput();
  return {
    title: input.title,
    summary: "Build and operate payment services for a growing platform.",
    responsibilities: ["Design and ship backend services", "Review pull requests"],
    requiredSkills: ["Java", "Spring Boot", "PostgreSQL"],
    preferredSkills: ["AWS", "Docker"],
    qualifications: ["Bachelor's degree or equivalent experience"],
    benefits: ["Flexible working hours"],
    experience: input.experience,
    location: input.location,
    employmentType: input.employmentType,
    workMode: input.workMode,
    ...overrides,
  };
}

const AI_JSON = JSON.stringify({
  title: "Backend Engineer",
  summary: "Build and operate payment services.",
  responsibilities: ["Design backend services", "Own service reliability"],
  requiredSkills: ["Java", "Spring Boot", "PostgreSQL"],
  preferredSkills: ["AWS"],
  qualifications: ["Bachelor's degree or equivalent experience"],
  benefits: ["Flexible working hours"],
  experience: "2-4 years",
  location: "Bangalore, India",
  employmentType: "Full-time",
  workMode: "Hybrid",
});

async function main() {
  console.log("═".repeat(70));
  console.log("  Recrutva — AI Job Description Generator Tests");
  console.log("═".repeat(70));

  // ─── A. Input validation ─────────────────────────────────────────
  section("A. Recruiter input validation");

  const validA = GenerateJobInputSchema.safeParse(VALID_INPUT);
  log("A", "valid input accepted", validA.success);
  log(
    "A",
    "skills parsed into an array",
    validA.success && Array.isArray(validA.data.skills) && validA.data.skills.length === 4,
  );

  const missingTitle = GenerateJobInputSchema.safeParse({ ...VALID_INPUT, title: "  " });
  log("A", "missing/blank title rejected", !missingTitle.success,
    !missingTitle.success ? missingTitle.error.issues[0]?.message : "");

  const missingType = GenerateJobInputSchema.safeParse({
    ...VALID_INPUT,
    employmentType: undefined,
  });
  log("A", "missing employment type rejected", !missingType.success);

  const badType = GenerateJobInputSchema.safeParse({
    ...VALID_INPUT,
    employmentType: "Freelance",
  });
  log("A", "unknown employment type rejected", !badType.success);

  const noSkills = GenerateJobInputSchema.safeParse({ ...VALID_INPUT, skills: [] });
  log("A", "empty skills rejected", !noSkills.success,
    !noSkills.success ? noSkills.error.issues[0]?.message : "");

  const blankSkills = GenerateJobInputSchema.safeParse({
    ...VALID_INPUT,
    skills: ["   ", ""],
  });
  log("A", "whitespace-only skills rejected", !blankSkills.success);

  const longTitle = GenerateJobInputSchema.safeParse({
    ...VALID_INPUT,
    title: "x".repeat(201),
  });
  log("A", "over-long title rejected", !longTitle.success);

  const longFreeText = GenerateJobInputSchema.safeParse({
    ...VALID_INPUT,
    responsibilities: "x".repeat(4001),
  });
  log("A", "over-long free text rejected", !longFreeText.success);

  const tooManySkills = GenerateJobInputSchema.safeParse({
    ...VALID_INPUT,
    skills: Array.from({ length: 45 }, (_, i) => `skill-${i}`),
  });
  log("A", "skill count capped", !tooManySkills.success);

  const normalised = GenerateJobInputSchema.safeParse({
    ...VALID_INPUT,
    skills: ["  Java  ", "java", "Spring Boot", ""],
  });
  log(
    "A",
    "skills trimmed + de-duplicated (case-insensitive)",
    normalised.success &&
      normalised.data.skills.length === 2 &&
      normalised.data.skills[0] === "Java",
    normalised.success ? normalised.data.skills.join(" | ") : "",
  );

  const defaultsApplied = GenerateJobInputSchema.safeParse({
    title: "QA Engineer",
    employmentType: "Contract",
    skills: ["Jest"],
  });
  log(
    "A",
    "optional fields default sensibly",
    defaultsApplied.success &&
      defaultsApplied.data.location === "Remote" &&
      defaultsApplied.data.workMode === "Remote" &&
      defaultsApplied.data.department === "",
    defaultsApplied.success ? `location=${defaultsApplied.data.location}` : "",
  );

  log(
    "A",
    "normalizeStringList caps and de-duplicates",
    normalizeStringList([" a ", "A", "b"], 40).length === 2,
  );

  // ─── B. Prompt ───────────────────────────────────────────────────
  section("B. Prompt contract");

  const prompt = buildJDPrompt(parsedInput());
  log("B", "prompt includes the role title", prompt.includes("Backend Engineer"));
  log("B", "prompt includes key skills", prompt.includes("Spring Boot"));
  log("B", "prompt states the employment type", prompt.includes("Full-time"));
  log("B", "prompt includes recruiter notes", prompt.includes("payments service"));
  log(
    "B",
    "prompt forbids inventing salary when none supplied",
    buildJDPrompt(parsedInput({ salaryRange: "" }))
      .toLowerCase()
      .includes("do not state or invent"),
  );
  log(
    "B",
    "prompt forbids inventing experience when none supplied",
    buildJDPrompt(parsedInput({ experience: "" }))
      .toLowerCase()
      .includes("do not invent years"),
  );
  log(
    "B",
    "prompt stays bounded for large input",
    buildJDPrompt(
      parsedInput({ responsibilities: "x".repeat(4000), additionalRequirements: "y".repeat(4000) }),
    ).length < 20000,
  );

  // ─── C. AI response handling ─────────────────────────────────────
  section("C. AI response handling");

  const okParse = parseGeneratedJDResponse(AI_JSON, parsedInput());
  log("C", "valid AI JSON accepted", okParse.success);
  log(
    "C",
    "AI lists validated as arrays",
    okParse.success && Array.isArray(okParse.jd.responsibilities) && okParse.jd.responsibilities.length === 2,
  );

  const fenced = parseGeneratedJDResponse("```json\n" + AI_JSON + "\n```", parsedInput());
  log("C", "code-fenced JSON recovered", fenced.success);

  const extraKeys = parseGeneratedJDResponse(
    JSON.stringify({ ...JSON.parse(AI_JSON), advice: "extra field", confidence: 0.9 }),
    parsedInput(),
  );
  log("C", "extra model keys stripped, not fatal", extraKeys.success);
  log(
    "C",
    "stripped keys absent from normalized JD",
    extraKeys.success && !("advice" in extraKeys.jd) && !("confidence" in extraKeys.jd),
  );

  const sloppyLists = parseGeneratedJDResponse(
    JSON.stringify({
      ...JSON.parse(AI_JSON),
      responsibilities: "- Build services\n- Review PRs\n\n",
      preferredSkills: "1. AWS\n2. Docker",
    }),
    parsedInput(),
  );
  log(
    "C",
    "bullet-string lists recovered into arrays",
    sloppyLists.success &&
      sloppyLists.jd.responsibilities.length === 2 &&
      sloppyLists.jd.preferredSkills.length === 2,
    sloppyLists.success
      ? `resp=${sloppyLists.jd.responsibilities.length} pref=${sloppyLists.jd.preferredSkills.length}`
      : "",
  );

  const noSummary = await expectFailure(async () =>
    parseGeneratedJDResponse(JSON.stringify({ ...JSON.parse(AI_JSON), summary: "" }), parsedInput()),
  );
  log("C", "missing summary rejected as malformed", !noSummary.success && noSummary.code === "malformed");

  const brokenJson = await expectFailure(async () =>
    parseGeneratedJDResponse('{ "summary": "oops", ', parsedInput()),
  );
  log("C", "malformed JSON rejected", !brokenJson.success && brokenJson.code === "malformed");

  const emptyResponse = await expectFailure(async () =>
    parseGeneratedJDResponse("   ", parsedInput()),
  );
  log("C", "empty response rejected", !emptyResponse.success && emptyResponse.code === "empty");

  log(
    "C",
    "coerceStringList handles array/string/null",
    coerceStringList(["a", "b"]).length === 2 &&
      coerceStringList("- a\n- b").length === 2 &&
      coerceStringList(null).length === 0,
  );

  // ─── D. Error classification ─────────────────────────────────────
  section("D. Groq error classification");

  const rateLimited = classifyGroqError({ status: 429, message: "Rate limit reached" });
  log("D", "HTTP 429 → rate_limit", !rateLimited.success && rateLimited.code === "rate_limit");

  const timedOut = classifyGroqError({ name: "APIConnectionTimeoutError", message: "timed out" });
  log("D", "timeout error → timeout", !timedOut.success && timedOut.code === "timeout");

  const unauthorized = classifyGroqError({ status: 401, message: "Invalid API Key" });
  log("D", "HTTP 401 → unavailable", !unauthorized.success && unauthorized.code === "unavailable");

  const unknown = classifyGroqError(new Error("something exploded"));
  log("D", "unknown error → safe generic message", !unknown.success && unknown.code === "unavailable");
  log(
    "D",
    "no provider internals leaked to the user",
    !unknown.error.toLowerCase().includes("exploded") &&
      !unauthorized.error.toLowerCase().includes("api key"),
  );

  // ─── E. Normalization ────────────────────────────────────────────
  section("E. Normalization — recruiter input wins");

  const input = parsedInput();
  const raw = {
    title: "Invented Chief Wizard",
    summary: "A summary.",
    responsibilities: ["Do things"],
    requiredSkills: [],
    preferredSkills: [],
    qualifications: [],
    benefits: [],
    experience: "10+ years",
    location: "Mars",
    employmentType: "Internship",
    workMode: "Remote",
  };
  const normalized = normalizeGeneratedJD(raw, input);
  log("E", "title taken from recruiter input", normalized.title === input.title);
  log("E", "location taken from recruiter input", normalized.location === input.location);
  log("E", "experience taken from recruiter input", normalized.experience === input.experience);
  log(
    "E",
    "employment type taken from recruiter input",
    normalized.employmentType === input.employmentType,
  );
  log("E", "work mode taken from recruiter input", normalized.workMode === input.workMode);
  log(
    "E",
    "required skills fall back to the recruiter's key skills when AI returns none",
    normalized.requiredSkills.length === input.skills.length,
  );

  // ─── F. Description composition ──────────────────────────────────
  section("F. Description composition");

  const composed = composeJobDescription(makeJd(), {
    department: "Engineering",
    salaryRange: "12-18 LPA",
  });
  log("F", "includes the summary", composed.includes("payment services"));
  log("F", "includes a Responsibilities section", composed.includes("Responsibilities"));
  log("F", "includes a Required Skills section", composed.includes("Required Skills"));
  log("F", "includes preferred skills", composed.includes("Preferred Skills"));
  log("F", "includes qualifications", composed.includes("Qualifications"));
  log("F", "includes employment facts", composed.includes("Employment Type: Full-time"));
  log("F", "includes salary range when provided", composed.includes("Salary Range: 12-18 LPA"));
  log("F", "output is bounded", composed.length <= 20000);

  // ─── G. Publish rules ────────────────────────────────────────────
  section("G. Publish completeness");

  log("G", "complete JD is publishable", validatePublishable(makeJd()) === null);
  log(
    "G",
    "missing summary blocks publishing",
    validatePublishable(makeJd({ summary: "" })) === "Add a job overview before publishing",
  );
  log(
    "G",
    "missing responsibilities block publishing",
    validatePublishable(makeJd({ responsibilities: [] })) !== null,
  );
  log(
    "G",
    "missing required skills block publishing",
    validatePublishable(makeJd({ requiredSkills: [] })) !== null,
  );

  // ─── H. Rate limiter ─────────────────────────────────────────────
  section("H. Rate limiter fail-open");

  const limiter = await rateLimit(
    { endpoint: "ai-generate-jd-test", limit: 10, windowSeconds: 600 },
    "user:test",
  );
  log(
    "H",
    "allows the request when Redis is not configured",
    limiter.success === true && limiter.limit === 10,
    `redisConfigured=${Boolean(process.env.REDIS_URL)}`,
  );

  // ─── I. Database persistence ─────────────────────────────────────
  section("I. Database persistence & ownership");

  const createdIds: number[] = [];

  try {
    const payloadA = { jobId: null, input: parsedInput(), jd: makeJd() };

    const draft = await upsertJob(RECRUITER_A, payloadA, "DRAFT");
    log("I", "draft created", draft.success && draft.status === "DRAFT" && draft.created === true);
    if (!draft.success) throw new Error("draft creation failed — aborting DB tests");
    createdIds.push(draft.jobId);

    const [row] = await db.select().from(jobs).where(eq(jobs.id, draft.jobId)).limit(1);
    log("I", "row persisted with status DRAFT", row?.status === "DRAFT");
    log("I", "owner recorded", row?.userId === RECRUITER_A);
    log("I", "recruiter input preserved in source_input", row?.sourceInput !== null);
    log("I", "structured sections persisted", Array.isArray(row?.requiredSkills) && row!.requiredSkills!.length === 3);
    log("I", "rendered description persisted", (row?.description ?? "").includes("Responsibilities"));
    log("I", "created job has no public listing eligibility", row?.status !== undefined && !PUBLIC_JOB_STATUSES.includes(row.status as never));

    // Update in place — must not duplicate.
    const again = await upsertJob(
      RECRUITER_A,
      { ...payloadA, jobId: draft.jobId, jd: makeJd({ summary: "Updated overview." }) },
      "DRAFT",
    );
    log(
      "I",
      "re-saving updates the same row instead of duplicating",
      again.success && again.jobId === draft.jobId && again.created === false,
    );

    const rowsForA = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.userId, RECRUITER_A));
    log("I", "exactly one row exists for the owner", rowsForA.length === createdIds.length,
      `rows=${rowsForA.length}`);

    const [updated] = await db.select().from(jobs).where(eq(jobs.id, draft.jobId)).limit(1);
    log("I", "edits persisted on update", updated?.summary === "Updated overview.");

    // Ownership isolation.
    const foreignRead = await getOwnedJobForEditing(RECRUITER_B, draft.jobId);
    log("I", "another recruiter cannot read the job", foreignRead === null);

    const foreignWrite = await expectFailure(async () =>
      upsertJob(RECRUITER_B, { ...payloadA, jobId: draft.jobId }, "DRAFT"),
    );
    log("I", "another recruiter cannot overwrite the job", !foreignWrite.success && foreignWrite.code === "forbidden");

    const [stillOwned] = await db.select().from(jobs).where(eq(jobs.id, draft.jobId)).limit(1);
    log("I", "unauthorised write left the row untouched", stillOwned?.userId === RECRUITER_A);

    // Publish rules at the service boundary.
    const incomplete = await upsertJob(
      RECRUITER_A,
      { ...payloadA, jobId: draft.jobId, jd: makeJd({ summary: "" }) },
      "PUBLISHED",
    );
    log("I", "incomplete JD cannot be published", !incomplete.success && incomplete.code === "incomplete");

    const invalidPayload = await expectFailure(async () =>
      upsertJob(RECRUITER_A, { jobId: null, input: { title: "" }, jd: {} }, "DRAFT"),
    );
    log("I", "invalid payload rejected", !invalidPayload.success && invalidPayload.code === "invalid");

    const publish = await upsertJob(
      RECRUITER_A,
      { ...payloadA, jobId: draft.jobId, jd: makeJd() },
      "PUBLISHED",
    );
    log("I", "publish succeeds", publish.success && publish.status === "PUBLISHED");

    const [published] = await db.select().from(jobs).where(eq(jobs.id, draft.jobId)).limit(1);
    log("I", "status is PUBLISHED in the database", published?.status === "PUBLISHED");

    const publicRows = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(inArray(jobs.status, [...PUBLIC_JOB_STATUSES]));
    log(
      "I",
      "published job appears in the public listing predicate",
      publicRows.some((r) => r.id === draft.jobId),
    );

    // Reopening a draft restores the original input.
    const reopen = await getOwnedJobForEditing(RECRUITER_A, draft.jobId);
    log("I", "owner can reopen the job for editing", reopen !== null && reopen.id === draft.jobId);
    const restored = reopen ? toGenerateJobInput(reopen, reopen.sourceInput) : null;
    log(
      "I",
      "reopened form input matches the original recruiter input",
      restored !== null &&
        restored.title === VALID_INPUT.title &&
        restored.skills.join(",") === VALID_INPUT.skills.join(","),
      restored ? restored.title : "",
    );
    log(
      "I",
      "reopened JD retains the edited sections",
      reopen !== null && reopen.requiredSkills.length === 3,
    );

    const missing = await getOwnedJobForEditing(RECRUITER_A, 999_999_999);
    log("I", "non-existent job returns null", missing === null);
  } finally {
    if (createdIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdIds));
      const leftovers = await db.select({ id: jobs.id }).from(jobs).where(inArray(jobs.id, createdIds));
      log("I", "test rows cleaned up", leftovers.length === 0, `removed=${createdIds.length}`);
    }
  }

  // ─── J. Live generation ──────────────────────────────────────────
  section("J. Live Groq generation");

  if (process.env.SKIP_LIVE_AI === "1") {
    console.log("⏭  Skipped (SKIP_LIVE_AI=1)");
  } else {
    const live = await generateJobDescription(VALID_INPUT);
    log("J", "live generation succeeded", live.success, live.success ? "" : live.error);

    if (live.success) {
      log("J", "live summary is non-empty", live.jd.summary.length > 0);
      log("J", "live responsibilities are actionable list items", live.jd.responsibilities.length > 0);
      log("J", "live required skills preserved", live.jd.requiredSkills.length > 0);
      log(
        "J",
        "live output did not inherit invented facts",
        live.jd.employmentType === input.employmentType && live.jd.location === input.location,
      );
    }

    const badInput = await expectFailure(async () => generateJobDescription({ title: "" }));
    log("J", "invalid input rejected before calling Groq", !badInput.success && badInput.code === "invalid_input");
  }

  // ─── Summary ─────────────────────────────────────────────────────
  const failed = results.filter((r) => r.s === "FAIL");
  console.log("\n" + "═".repeat(70));
  console.log(`  ${results.length - failed.length}/${results.length} checks passed`);
  console.log("═".repeat(70));

  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const f of failed) console.log(`  ❌ [${f.section}] ${f.t}`);
    process.exitCode = 1;
  } else {
    console.log("All checks passed.");
  }
}

main().catch((err) => {
  console.error("\nTest run aborted:", err);
  process.exit(1);
});
