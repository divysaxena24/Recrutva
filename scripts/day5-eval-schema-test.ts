/**
 * Day 5 — AI Interview evaluation schema validation tests (P0-2).
 *
 * Run: npx tsx scripts/day5-eval-schema-test.ts
 *
 * Pure Zod tests — no DB, no network. Covers the focused cases:
 *   A. Valid evaluation (score 75 → persisted as 75)
 *   B. Decimal score (75.6 → normalized to integer)
 *   C. Negative score (rejected or safely normalized; never persisted invalid)
 *   D. Score >100 (rejected or safely normalized; never persisted >100)
 *   E. Missing required evaluation field (rejected)
 *   F. Invalid breakdown mark (rejected)
 * Plus malformed-type cases (NaN, Infinity, string, null) which must never
 * persist.
 */
import { InterviewEvaluationSchema } from "../lib/schemas/interview";

const results: { t: string; s: "PASS" | "FAIL"; d: string }[] = [];
function log(t: string, ok: boolean, d: string) {
  results.push({ t, s: ok ? "PASS" : "FAIL", d });
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${t}: ${d}`);
}

const VALID = {
  totalScore: 75,
  executiveSummary: "Strong technical depth with clear communication.",
  breakdown: [
    {
      question: "Explain REST vs GraphQL",
      expectedAnswer: "Compare trade-offs and use cases",
      userAnswer: "REST uses multiple endpoints, GraphQL a single schema.",
      marks: 8,
      feedback: "Good comparison, missing caching details.",
    },
  ],
};

function main() {
  console.log("═".repeat(64));
  console.log("  Day 5 — Interview Evaluation Schema Tests (P0-2)");
  console.log("═".repeat(64));

  // A. Valid evaluation persisted unchanged
  const a = InterviewEvaluationSchema.safeParse(VALID);
  log("A: valid evaluation (score 75) accepted as 75", a.success && a.data.totalScore === 75, a.success ? `totalScore=${a.data.totalScore}` : "REJECTED");

  // B. Decimal score normalized to integer
  const b = InterviewEvaluationSchema.safeParse({ ...VALID, totalScore: 75.6 });
  log("B: decimal score 75.6 normalized to integer", b.success && b.data.totalScore === 76 && Number.isInteger(b.data.totalScore), b.success ? `totalScore=${b.data.totalScore}` : "REJECTED");

  // C. Negative score safely normalized (never persisted negative)
  const c = InterviewEvaluationSchema.safeParse({ ...VALID, totalScore: -5 });
  log("C: negative score -5 normalized to 0", c.success && c.data.totalScore === 0, c.success ? `totalScore=${c.data.totalScore}` : "REJECTED");

  // D. Score >100 safely normalized (never persisted >100)
  const d = InterviewEvaluationSchema.safeParse({ ...VALID, totalScore: 150 });
  log("D: score 150 normalized to 100", d.success && d.data.totalScore === 100, d.success ? `totalScore=${d.data.totalScore}` : "REJECTED");

  // E. Missing required field rejected
  const e1 = InterviewEvaluationSchema.safeParse({ totalScore: 75, breakdown: VALID.breakdown });
  const e2 = InterviewEvaluationSchema.safeParse({ totalScore: 75, executiveSummary: "ok" });
  log("E: missing executiveSummary rejected", !e1.success, e1.success ? "ACCEPTED" : "rejected");
  log("E: missing breakdown rejected", !e2.success, e2.success ? "ACCEPTED" : "rejected");

  // F. Invalid breakdown marks rejected
  const f1 = InterviewEvaluationSchema.safeParse({
    ...VALID,
    breakdown: [{ ...VALID.breakdown[0], marks: 15 }],
  });
  const f2 = InterviewEvaluationSchema.safeParse({
    ...VALID,
    breakdown: [{ ...VALID.breakdown[0], marks: -1 }],
  });
  log("F: breakdown mark 15 (>10) rejected", !f1.success, f1.success ? "ACCEPTED" : "rejected");
  log("F: breakdown mark -1 rejected", !f2.success, f2.success ? "ACCEPTED" : "rejected");

  // Breakdown marks within 0-10 are accepted and rounded to integer
  const g = InterviewEvaluationSchema.safeParse({
    ...VALID,
    breakdown: [{ ...VALID.breakdown[0], marks: 7.6 }],
  });
  log("breakdown mark 7.6 rounded to 8", g.success && g.data.breakdown[0].marks === 8, g.success ? `marks=${g.data.breakdown[0].marks}` : "REJECTED");

  // Malformed types never persist
  const h1 = InterviewEvaluationSchema.safeParse({ ...VALID, totalScore: "75" });
  const h2 = InterviewEvaluationSchema.safeParse({ ...VALID, totalScore: null });
  const h3 = InterviewEvaluationSchema.safeParse({ ...VALID, totalScore: Number.NaN });
  const h4 = InterviewEvaluationSchema.safeParse({ ...VALID, totalScore: Number.POSITIVE_INFINITY });
  const h5 = InterviewEvaluationSchema.safeParse({
    ...VALID,
    breakdown: [{ ...VALID.breakdown[0], marks: "8" }],
  });
  log("string totalScore rejected", !h1.success, h1.success ? "ACCEPTED" : "rejected");
  log("null totalScore rejected", !h2.success, h2.success ? "ACCEPTED" : "rejected");
  log("NaN totalScore rejected", !h3.success, h3.success ? "ACCEPTED" : "rejected");
  log("Infinity totalScore rejected", !h4.success, h4.success ? "ACCEPTED" : "rejected");
  log("string marks rejected", !h5.success, h5.success ? "ACCEPTED" : "rejected");

  const failed = results.filter((r) => r.s === "FAIL").length;
  console.log(`\n${results.length - failed}/${results.length} passed (${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

main();