/**
 * Phase 6 — Host-side integration regression over real application modules.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json scripts/phase6-flow-test.ts
 *
 * Requires (from .env): DATABASE_URL, GROQ_API_KEY. Redis optional (cache tests
 * skip cleanly if REDIS_URL is unset).
 *
 * Creates isolated fixtures (jobs/pipelines/candidates under a unique
 * "phase6-*" recruiter id) and removes them on completion.
 */
import { config } from "dotenv";
config({ path: ".env" });

import { db } from "../db";
import {
  jobs,
  applicants,
  pipelines,
  pipelineRounds,
  candidateRounds,
} from "../db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { runResumeScreening } from "../lib/screening";
import {
  generateAssessmentQuestions,
  gradeAssessment,
} from "../lib/assessment";
import {
  parseAssessmentConfig,
  SubmissionSchema,
  AssessmentQuestionsSchema,
} from "../lib/schemas/assessment";
import { ScreeningResultSchema } from "../lib/schemas/screening";
import {
  CreateCandidateSchema,
  CreateJobSchema,
  UpdateCandidateRoundStatusSchema,
} from "../lib/schemas/actions";
import {
  completeScreeningRound,
  completeAIRound,
} from "../lib/pipeline-internal";
import { CACHE_KEYS } from "../lib/cache";

const results: { t: string; s: "PASS" | "FAIL" | "SKIP"; d: string }[] = [];
function log(t: string, ok: boolean | undefined, d: string) {
  const s = ok === undefined ? "SKIP" : ok ? "PASS" : "FAIL";
  results.push({ t, s, d });
  const icon = s === "PASS" ? "✅" : s === "FAIL" ? "❌" : "⏭️";
  console.log(`${icon} ${t}: ${d}`);
}

const TS = Date.now();
const UID = `phase6-recruiter-${TS}`;

// ── Fixture ids filled during setup ───────────────────────────────
let jobAId = 0; // threshold 50, full pipeline
let jobBId = 0; // screening threshold 99 -> forces FAIL
let pipeAId = 0;
let pipeBId = 0;
let candAId = 0; // strong resume, screening PASS candidate
let candBId = 0; // FAIL candidate
const cleanupIds: number[] = [];

async function cleanup() {
  try {
    if (cleanupIds.length) {
      await db
        .delete(candidateRounds)
        .where(inArray(candidateRounds.candidateId, cleanupIds));
      await db.delete(applicants).where(inArray(applicants.id, cleanupIds));
    }
    if (pipeAId) {
      await db.delete(pipelineRounds).where(eq(pipelineRounds.pipelineId, pipeAId));
    }
    if (pipeBId) {
      await db.delete(pipelineRounds).where(eq(pipelineRounds.pipelineId, pipeBId));
      await db.delete(pipelines).where(eq(pipelines.id, pipeBId));
    }
    // pipelines for both jobs
    for (const pid of [pipeAId]) {
      await db.delete(pipelines).where(eq(pipelines.id, pid));
    }
    if (jobAId) await db.delete(jobs).where(eq(jobs.id, jobAId));
    if (jobBId) await db.delete(jobs).where(eq(jobs.id, jobBId));
  } catch (e) {
    console.error("Cleanup error:", e instanceof Error ? e.message : e);
  }
}

const STRONG_RESUME = `
Software Engineer with 6 years of experience in TypeScript, React, Node.js, and PostgreSQL.
Led the design of a real-time dashboard serving 50k users. Built REST APIs with 99.9% uptime.
Strong system design, algorithms, and testing discipline. Previously at a fintech startup.
`.trim();

const WEAK_RESUME = `
Recently graduated with a degree in English literature. Worked part time in retail.
No professional software development experience. Interested in learning to code.
`.trim();

async function main() {
  console.log("═".repeat(64));
  console.log("  Phase 6 — Flow & Integration Regression");
  console.log(`  Fixture prefix: ${UID}`);
  console.log("═".repeat(64));

  // ── 0. DB connectivity ────────────────────────────────────────────
  try {
    await db.execute(`SELECT 1`);
    log("DB connectivity", true, "SELECT 1 ok");
  } catch (e) {
    log("DB connectivity", false, e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  // ── 1. Fixtures ───────────────────────────────────────────────────
  const [jobA] = await db
    .insert(jobs)
    .values({
      userId: UID,
      title: `Phase6 Job A ${TS}`,
      description: "Backend engineer role. Requires TypeScript, Node.js, PostgreSQL, REST APIs.",
      requirements: "5+ years backend; TypeScript; system design",
      location: "Remote",
      status: "Open",
    })
    .returning();
  jobAId = jobA.id;
  const [jobB] = await db
    .insert(jobs)
    .values({
      userId: UID,
      title: `Phase6 Job B ${TS}`,
      description: "Senior role with strict bar.",
      requirements: "10+ years in the exact stack",
      location: "Remote",
      status: "Open",
    })
    .returning();
  jobBId = jobB.id;

  const [pipeA] = await db
    .insert(pipelines)
    .values({ jobId: jobAId, name: "Phase6 Pipeline A" })
    .returning();
  pipeAId = pipeA.id;
  const [pipeB] = await db
    .insert(pipelines)
    .values({ jobId: jobBId, name: "Phase6 Pipeline B" })
    .returning();

  // Pipe A rounds: RESUME_SCREENING(thr50) -> ASSESSMENT(3q, thr60) -> AI_INTERVIEW -> MANUAL_REVIEW
  const [rScreenA] = await db
    .insert(pipelineRounds)
    .values({
      pipelineId: pipeA.id,
      name: "Resume Screening",
      type: "RESUME_SCREENING",
      order: 1,
      configuration: { passThreshold: 50 },
    })
    .returning();
  const [rAssessA] = await db
    .insert(pipelineRounds)
    .values({
      pipelineId: pipeA.id,
      name: "AI Assessment",
      type: "ASSESSMENT",
      order: 2,
      configuration: { questionCount: 3, marksPerQuestion: 10, passThreshold: 60 },
    })
    .returning();
  const [rInterviewA] = await db
    .insert(pipelineRounds)
    .values({
      pipelineId: pipeA.id,
      name: "AI Interview",
      type: "AI_INTERVIEW",
      order: 3,
      configuration: { passThreshold: 50 },
    })
    .returning();
  await db
    .insert(pipelineRounds)
    .values({
      pipelineId: pipeA.id,
      name: "Final Review",
      type: "MANUAL_REVIEW",
      order: 4,
      configuration: {},
    })
    .returning();
  pipeBId = pipeB.id;
  // Pipe B rounds: RESUME_SCREENING(thr99)
  const [rScreenB] = await db
    .insert(pipelineRounds)
    .values({
      pipelineId: pipeB.id,
      name: "Resume Screening",
      type: "RESUME_SCREENING",
      order: 1,
      configuration: { passThreshold: 99 },
    })
    .returning();

  // Candidates (mirror createCandidate: applicant + first round ACTIVE)
  const [candA] = await db
    .insert(applicants)
    .values({
      userId: UID,
      targetJobId: jobAId,
      jobTitle: "Phase6 Job A",
      name: "Ada Lovelace",
      email: `ada-${TS}@phase6.test`,
      phone: "+1-555-0100",
      resumeText: STRONG_RESUME,
      status: "Ready",
    })
    .returning();
  candAId = candA.id;
  cleanupIds.push(candAId);
  const [candB] = await db
    .insert(applicants)
    .values({
      userId: UID,
      targetJobId: jobBId,
      jobTitle: "Phase6 Job B",
      name: "Bob Builder",
      email: `bob-${TS}@phase6.test`,
      phone: "+1-555-0101",
      resumeText: WEAK_RESUME,
      status: "Ready",
    })
    .returning();
  candBId = candB.id;
  cleanupIds.push(candBId);

  await db.insert(candidateRounds).values({
    candidateId: candAId,
    roundId: rScreenA.id,
    status: "ACTIVE",
    startedAt: new Date(),
  });
  await db.insert(candidateRounds).values({
    candidateId: candBId,
    roundId: rScreenB.id,
    status: "ACTIVE",
    startedAt: new Date(),
  });
  log("Fixtures created", true, `jobs ${jobAId}/${jobBId}, candidates ${candAId}/${candBId}`);

  // ── 2. Resume screening: PASS path (candidate A, threshold 50) ────
  let screenA = await completeScreeningRound({ candidateId: candAId });
  const screenARes = screenA as { success: boolean; data?: any; error?: string };
  log(
    "Screening A (strong resume) succeeds",
    screenARes.success === true,
    screenARes.error ?? JSON.stringify(screenARes.data)
  );

  const [crScreenA] = await db
    .select()
    .from(candidateRounds)
    .where(
      and(eq(candidateRounds.candidateId, candAId), eq(candidateRounds.roundId, rScreenA.id))
    )
    .limit(1);
  if (crScreenA) {
    const sc = typeof crScreenA.score === "number" ? crScreenA.score : Number(crScreenA.score);
    log("Screening A completed status", crScreenA.status === "PASSED" || crScreenA.status === "FAILED", `status=${crScreenA.status}`);
    log("Screening A score 0-100", !Number.isNaN(sc) && sc >= 0 && sc <= 100, `score=${sc}`);
    log("Screening A evaluation persisted", crScreenA.evaluation != null, "evaluation jsonb set");
    log("Screening A feedback persisted", Boolean(crScreenA.feedback), "feedback set");
    if (crScreenA.status === "PASSED") {
      const [next] = await db
        .select()
        .from(candidateRounds)
        .where(
          and(eq(candidateRounds.candidateId, candAId), eq(candidateRounds.roundId, rAssessA.id))
        )
        .limit(1);
      log("Screening PASS activates ASSESSMENT round", next?.status === "ACTIVE", `next.status=${next?.status}`);
    }
  } else {
    log("Screening A round row exists", false, "missing");
  }

  // ── 3. Resume screening: FAIL path (candidate B, threshold 99) ────
  let screenB = await completeScreeningRound({ candidateId: candBId });
  const screenBRes = screenB as { success: boolean; data?: any; error?: string };
  log(
    "Screening B runs",
    screenBRes.success === true,
    screenBRes.error ?? JSON.stringify(screenBRes.data)
  );
  const [crScreenB] = await db
    .select()
    .from(candidateRounds)
    .where(
      and(eq(candidateRounds.candidateId, candBId), eq(candidateRounds.roundId, rScreenB.id))
    )
    .limit(1);
  log("Screening B (weak resume, thr99) FAILED", crScreenB?.status === "FAILED", `status=${crScreenB?.status}`);

  // ── 4. runResumeScreening direct + Zod schema ─────────────────────
  const direct = await runResumeScreening({
    candidateId: candAId,
    jobTitle: "Backend Engineer",
    jobDescription: "TypeScript, Node.js, PostgreSQL backend role.",
    jobRequirements: null,
    resumeText: STRONG_RESUME,
    passThreshold: 50,
  });
  log("runResumeScreening direct", direct.success === true, direct.success ? `score=${(direct as any).score}` : (direct as any).error);
  log("Screening Zod rejects malformed", !ScreeningResultSchema.safeParse({ score: 101, nope: true }).success, "invalid object rejected");

  // ── 5. Assessment generation + persistence + safe questions ───────
  const cfg = parseAssessmentConfig(rAssessA.configuration as Record<string, unknown> | null);
  const gen = await generateAssessmentQuestions({
    candidateId: candAId,
    jobTitle: "Backend Engineer",
    jobDescription: "TypeScript, Node.js, PostgreSQL backend role.",
    jobRequirements: null,
    resumeText: STRONG_RESUME,
    config: cfg,
  });
  log("Assessment questions generated", gen.success === true, gen.success ? `${(gen as any).questions.questions.length} questions` : (gen as any).error);
  let persistedQuestions: any[] = [];
  if (gen.success) {
    persistedQuestions = gen.questions.questions;
    const safe = persistedQuestions.map((q) => ({ id: q.id, question: q.question, type: q.type, maxMarks: q.maxMarks }));
    const leakedExpected = safe.some((q: any) => "expectedAnswer" in q);
    log("Safe questions omit expectedAnswer", !leakedExpected, `${safe.length} safe questions`);
    const schemaOk = AssessmentQuestionsSchema.safeParse(gen.questions).success;
    log("Questions validate against schema", schemaOk, "AssessmentQuestionsSchema");
    // persist (mirrors GET route)
    await db
      .update(candidateRounds)
      .set({ evaluation: { questions: persistedQuestions, answers: {} } })
      .where(eq(candidateRounds.id, crScreenA?.id ?? -1));
  }

  // ── 6. Submission schema validations ──────────────────────────────
  const q1 = persistedQuestions[0];
  log(
    "SubmissionSchema valid answers",
    SubmissionSchema.safeParse({ answers: [{ questionId: q1?.id ?? 1, answer: "My answer" }] }).success,
    ""
  );
  log(
    "SubmissionSchema rejects unknown questionId",
    !SubmissionSchema.safeParse({ answers: [{ questionId: 99999, answer: "x" }] }).success,
    "unknown id passes schema but route checks set"
  );
  log(
    "SubmissionSchema rejects oversized answer (>8000)",
    !SubmissionSchema.safeParse({ answers: [{ questionId: 1, answer: "a".repeat(8001) }] }).success,
    ""
  );
  log(
    "SubmissionSchema rejects >50 answers",
    !SubmissionSchema.safeParse({ answers: Array.from({ length: 51 }, (_, i) => ({ questionId: i + 1, answer: "x" })) }).success,
    ""
  );
  log(
    "SubmissionSchema rejects empty answers",
    !SubmissionSchema.safeParse({ answers: [] }).success,
    ""
  );

  // ── 7. AI grading ─────────────────────────────────────────────────
  if (persistedQuestions.length > 0) {
    const grading = await gradeAssessment({
      candidateId: candAId,
      jobTitle: "Backend Engineer",
      jobDescription: "Backend role.",
      questions: persistedQuestions.map((q) => ({
        id: q.id,
        question: q.question,
        expectedAnswer: q.expectedAnswer,
        maxMarks: q.maxMarks,
      })),
      answers: persistedQuestions.map((q, i) => ({
        questionId: q.id,
        answer: i % 2 === 0 ? "Strong detailed technical answer with specifics." : "",
      })),
      config: cfg,
    });
    log("Assessment graded", grading.success === true, grading.success ? JSON.stringify((grading as any).result).slice(0, 200) : (grading as any).error);
    if (grading.success) {
      const r = grading.result;
      const marksOk = r.breakdown.every((b) => b.marks >= 0 && b.marks <= b.maxMarks);
      const sum = r.breakdown.reduce((a, b) => a + b.marks, 0);
      const maxSum = r.breakdown.reduce((a, b) => a + b.maxMarks, 0);
      const pctOk = r.percentage >= 0 && r.percentage <= 100;
      const pctConsistent = Math.abs(r.percentage - (maxSum > 0 ? (sum / maxSum) * 100 : 0)) < 1;
      log("Grading marks clamped 0..max", marksOk, JSON.stringify(r.breakdown.map((b) => b.marks)));
      log("Grading totals recalculated (sum=maxSum)", r.totalScore === sum && r.maxScore === maxSum, `total=${r.totalScore} max=${r.maxScore}`);
      log("Grading percentage 0-100 & consistent", pctOk && pctConsistent, `pct=${r.percentage}`);
    }
  } else {
    log("Assessment graded", undefined, "SKIP — no questions generated");
  }

  // ── 8. Interview completion via completeAIRound ───────────────────
  // Move candidate A into AI_INTERVIEW as ACTIVE (screening PASS would have
  // activated ASSESSMENT; we simulate advancing past assessment by activating
  // the interview round directly — assessment advance logic is in the route).
  const [crAssess] = await db
    .select({ id: candidateRounds.id, status: candidateRounds.status })
    .from(candidateRounds)
    .where(
      and(eq(candidateRounds.candidateId, candAId), eq(candidateRounds.roundId, rAssessA.id))
    )
    .limit(1);
  const aiRoundRow = await db
    .select({ id: candidateRounds.id })
    .from(candidateRounds)
    .where(
      and(eq(candidateRounds.candidateId, candAId), eq(candidateRounds.roundId, rInterviewA.id))
    )
    .limit(1);
  let aiCrId: number | null = aiRoundRow[0]?.id ?? null;
  if (!aiCrId) {
    const [ins] = await db
      .insert(candidateRounds)
      .values({ candidateId: candAId, roundId: rInterviewA.id, status: "ACTIVE", startedAt: new Date() })
      .returning();
    aiCrId = ins.id;
  } else {
    await db
      .update(candidateRounds)
      .set({ status: "ACTIVE", startedAt: new Date() })
      .where(eq(candidateRounds.id, aiCrId));
  }
  log("Candidate A at AI_INTERVIEW (ACTIVE)", true, `candidateRound=${aiCrId}`);

  const ai1 = await completeAIRound({ candidateId: candAId, score: 72, summary: "Great answers", evaluation: { totalScore: 72 } });
  log("completeAIRound PASS (score 72)", (ai1 as any).success === true, JSON.stringify((ai1 as any).data));
  const [crAiA] = await db
    .select()
    .from(candidateRounds)
    .where(eq(candidateRounds.id, aiCrId!))
    .limit(1);
  log("AI round PASSED persisted", crAiA?.status === "PASSED" && crAiA?.score === 72, `status=${crAiA?.status} score=${crAiA?.score}`);

  // duplicate completion guard
  await completeAIRound({ candidateId: candAId, score: 10, summary: "overwrite attempt", evaluation: { totalScore: 10 } });
  const [crAiA2] = await db
    .select()
    .from(candidateRounds)
    .where(eq(candidateRounds.id, aiCrId!))
    .limit(1);
  log("Duplicate interview completion does not overwrite", crAiA2?.score === 72 && crAiA2?.status === "PASSED", `score=${crAiA2?.score}`);

  // next round (MANUAL_REVIEW) activated after PASS
  const mrRound = await db
    .select()
    .from(pipelineRounds)
    .where(and(eq(pipelineRounds.pipelineId, pipeA.id), eq(pipelineRounds.type, "MANUAL_REVIEW")))
    .limit(1);
  const mrCr = await db
    .select()
    .from(candidateRounds)
    .where(
      and(eq(candidateRounds.candidateId, candAId), eq(candidateRounds.roundId, mrRound[0].id))
    )
    .limit(1);
  log("Interview PASS activates MANUAL_REVIEW", mrCr[0]?.status === "ACTIVE", `next.status=${mrCr[0]?.status}`);

  // FAIL path on interview (reuse candidate A? it advanced; create candidate C on pipeA)
  const [candC] = await db
    .insert(applicants)
    .values({
      userId: UID,
      targetJobId: jobAId,
      jobTitle: "Phase6 Job A",
      name: "Carol Coder",
      email: `carol-${TS}@phase6.test`,
      phone: "+1-555-0102",
      resumeText: STRONG_RESUME,
      status: "Ready",
    })
    .returning();
  cleanupIds.push(candC.id);
  await db.insert(candidateRounds).values({
    candidateId: candC.id,
    roundId: rInterviewA.id,
    status: "ACTIVE",
    startedAt: new Date(),
  });
  const aiFail = await completeAIRound({ candidateId: candC.id, score: 30, summary: "Weak", evaluation: {} });
  log("completeAIRound FAIL (score 30)", (aiFail as any).success === true, JSON.stringify((aiFail as any).data));
  const crC = await db
    .select()
    .from(candidateRounds)
    .where(
      and(eq(candidateRounds.candidateId, candC.id), eq(candidateRounds.roundId, rInterviewA.id))
    )
    .limit(1);
  log("AI FAIL round FAILED", crC[0]?.status === "FAILED", `status=${crC[0]?.status}`);
  const crCnext = await db
    .select()
    .from(candidateRounds)
    .where(
      and(eq(candidateRounds.candidateId, candC.id), eq(candidateRounds.roundId, mrRound[0].id))
    )
    .limit(1);
  log("AI FAIL does not activate next round", crCnext.length === 0 || crCnext[0]?.status !== "ACTIVE", `next=${crCnext[0]?.status ?? "none"}`);
  // remove candidate C now (rounds first, then the applicant — FK order)
  await db.delete(candidateRounds).where(eq(candidateRounds.candidateId, candC.id));
  await db.delete(applicants).where(eq(applicants.id, candC.id));
  cleanupIds.pop(); // already removed manually

  // ── 9. Cache key isolation ────────────────────────────────────────
  const kA_A = CACHE_KEYS.interviewQuestions(1, 100);
  const kA_B = CACHE_KEYS.interviewQuestions(1, 101);
  const kB_A = CACHE_KEYS.interviewQuestions(2, 100);
  const k1 = CACHE_KEYS.interviewQuestions(1, null);
  const k2 = CACHE_KEYS.interviewQuestions(1, 100);
  log(
    "Interview cache keys isolated per candidate+job",
    kA_A !== kA_B && kA_A !== kB_A && kA_B !== kB_A && k1 !== k2 && k1 !== kA_A,
    `${kA_A} | ${kA_B} | ${kB_A}`
  );

  // ── 10. Action schema validation (shared Zod) ─────────────────────
  log(
    "CreateCandidateSchema rejects bad email",
    !CreateCandidateSchema.safeParse({ name: "A", email: "not-an-email", phone: "123" }).success,
    ""
  );
  log(
    "CreateCandidateSchema rejects short name",
    !CreateCandidateSchema.safeParse({ name: "A", email: "a@b.com", phone: "12345" }).success,
    ""
  );
  log(
    "CreateCandidateSchema rejects oversized resumeText (>20k)",
    !CreateCandidateSchema.safeParse({ name: "Alice", email: "a@b.com", phone: "12345", resumeText: "x".repeat(20001) }).success,
    ""
  );
  log(
    "CreateCandidateSchema accepts valid",
    CreateCandidateSchema.safeParse({ name: "Alice Smith", email: "a@b.com", phone: "+1 555 0100", resumeText: "resume", targetJobId: 1 }).success,
    ""
  );
  log(
    "CreateJobSchema rejects empty title",
    !CreateJobSchema.safeParse({ title: "  ", description: "desc" }).success,
    ""
  );
  log(
    "CreateJobSchema rejects oversized description",
    !CreateJobSchema.safeParse({ title: "Title", description: "x".repeat(20001) }).success,
    ""
  );
  log(
    "UpdateCandidateRoundStatusSchema rejects score>100",
    !UpdateCandidateRoundStatusSchema.safeParse({ candidateRoundId: 1, status: "PASSED", score: 150 }).success,
    ""
  );

  // ── Summary + cleanup ─────────────────────────────────────────────
  const failed = results.filter((r) => r.s === "FAIL").length;
  const skipped = results.filter((r) => r.s === "SKIP").length;
  console.log(`\n${results.length - failed - skipped}/${results.length} passed (${skipped} skipped, ${failed} failed)`);
  console.log("Cleaning up fixtures...");
  await cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch(async (e) => {
    console.error("Script error:", e);
    await cleanup();
    process.exit(1);
  });
