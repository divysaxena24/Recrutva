/**
 * Day 8 Phase 4 — Email service, templates & notification logic tests.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json scripts/phase4-email-test.ts
 *
 * Pure tests — no SMTP delivery, no DB writes, no network. Covers:
 *   A. Correct application URL generation (NEXT_PUBLIC_APP_URL)
 *   B. Candidate templates (assessment / interview / stage passed / stopped)
 *   C. Recruiter templates (new candidate / review / assessment / interview)
 *   D. No secrets, enums, or internal evaluation data in templates
 *   E. sendEmail never throws when SMTP is unconfigured / recipient invalid
 *   F. Idempotency lock fails open when Redis is unavailable
 */
import {
  buildAssessmentAvailableEmail,
  buildInterviewAvailableEmail,
  buildStagePassedEmail,
  buildNotProgressingEmail,
  buildRecruiterNewCandidateEmail,
  buildRecruiterManualReviewEmail,
  buildRecruiterAssessmentCompletedEmail,
  buildRecruiterInterviewCompletedEmail,
} from "../lib/email-templates";
import {
  sendEmail,
  getAppUrl,
  isValidEmail,
  isEmailConfigured,
  buildBrandedEmailHtml,
} from "../lib/email";
import { acquireNotificationLock } from "../lib/notifications";

const results: { t: string; s: "PASS" | "FAIL"; d: string }[] = [];
function log(t: string, ok: boolean, d: string) {
  results.push({ t, s: ok ? "PASS" : "FAIL", d });
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${t}: ${d}`);
}

const APP_URL = "https://recrutva.example.com";
const CANDIDATE_ID = 42;

function setAppUrl(value: string | undefined) {
  if (value === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = value;
}

function clearSmtpEnv() {
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
}

async function main() {
  console.log("═".repeat(64));
  console.log("DAY 8 PHASE 4 — Email service, templates & notification logic");
  console.log("═".repeat(64));

  // ─── A. Application URL generation ────────────────────────────────
  setAppUrl(APP_URL);
  log(
    "A1. getAppUrl returns NEXT_PUBLIC_APP_URL",
    getAppUrl() === APP_URL,
    `expected ${APP_URL}, got ${getAppUrl()}`
  );

  const assessment = buildAssessmentAvailableEmail({
    candidateName: "Divya",
    jobTitle: "Frontend Engineer",
    candidateId: CANDIDATE_ID,
  });
  log(
    "A2. Assessment email links use app URL",
    assessment.html.includes(`${APP_URL}/assessment/${CANDIDATE_ID}`),
    "assessment link"
  );
  log(
    "A3. Assessment email has CTA + branding + subject",
    assessment.html.includes("Start Assessment") &&
      assessment.html.includes("Recrutva") &&
      assessment.subject === "Your assessment is ready — Frontend Engineer",
    `subject: ${assessment.subject}`
  );

  const interview = buildInterviewAvailableEmail({
    candidateName: "Divya",
    jobTitle: "Frontend Engineer",
    candidateId: CANDIDATE_ID,
  });
  log(
    "A4. Interview email links use app URL + CTA",
    interview.html.includes(`${APP_URL}/interview/${CANDIDATE_ID}`) &&
      interview.html.includes("Start Interview"),
    "interview link"
  );

  setAppUrl(undefined);
  log(
    "A5. getAppUrl falls back to local default in dev",
    getAppUrl() === "http://localhost:3000",
    `got ${getAppUrl()}`
  );
  setAppUrl(APP_URL);

  // ─── B. Candidate templates ───────────────────────────────────────
  const stagePassed = buildStagePassedEmail({
    candidateName: "Divya",
    jobTitle: "Frontend Engineer",
    stageName: "Assessment",
    nextStep: "Your application is now under recruiter review.",
  });
  log(
    "B1. Stage passed email includes stage + next step",
    stagePassed.html.includes("Assessment") &&
      stagePassed.html.includes("under recruiter review") &&
      stagePassed.subject === "Update on your application — Frontend Engineer",
    `subject: ${stagePassed.subject}`
  );

  const stopped = buildNotProgressingEmail({
    candidateName: "Divya",
    jobTitle: "Frontend Engineer",
    stageName: "Assessment",
  });
  log(
    "B2. Not-progressing email is professional + no internals",
    stopped.html.includes("won't be moving forward") &&
      !/PASSED|FAILED|ACTIVE|threshold|evaluation|score/i.test(stopped.html),
    `subject: ${stopped.subject}`
  );

  // ─── C. Recruiter templates ───────────────────────────────────────
  const newCandidate = buildRecruiterNewCandidateEmail({
    candidateName: "Divya",
    candidateEmail: "divya@example.com",
    jobTitle: "Frontend Engineer",
    candidatesUrl: `${APP_URL}/dashboard/candidates?jobId=7`,
  });
  log(
    "C1. New-candidate email has candidate + job + recruiter link",
    newCandidate.html.includes("Divya") &&
      newCandidate.html.includes("divya@example.com") &&
      newCandidate.html.includes(`${APP_URL}/dashboard/candidates?jobId=7`) &&
      newCandidate.subject === "New candidate for Frontend Engineer",
    `subject: ${newCandidate.subject}`
  );

  const review = buildRecruiterManualReviewEmail({
    candidateName: "Divya",
    jobTitle: "Frontend Engineer",
    reviewUrl: `${APP_URL}/dashboard/candidates?jobId=7`,
  });
  log(
    "C2. Manual-review email has Review Candidate CTA",
    review.html.includes("Review Candidate") &&
      review.subject === "Candidate requires review — Frontend Engineer",
    `subject: ${review.subject}`
  );

  const withScore = buildRecruiterAssessmentCompletedEmail({
    candidateName: "Divya",
    jobTitle: "Frontend Engineer",
    score: 78,
    reviewUrl: `${APP_URL}/dashboard/candidates?jobId=7`,
  });
  const withoutScore = buildRecruiterInterviewCompletedEmail({
    candidateName: "Divya",
    jobTitle: "Frontend Engineer",
    score: null,
    reviewUrl: `${APP_URL}/dashboard/candidates?jobId=7`,
  });
  log(
    "C3. Completed emails show score when present, omit when absent",
    withScore.html.includes("78") &&
      !withoutScore.html.includes("score is") &&
      withoutScore.subject === "AI interview completed — Divya",
    `assessment subject: ${withScore.subject}`
  );

  // ─── D. No secrets / internals in any template ────────────────────
  const allHtml = [
    assessment.html,
    interview.html,
    stagePassed.html,
    stopped.html,
    newCandidate.html,
    review.html,
    withScore.html,
    withoutScore.html,
  ].join("\n");
  const forbidden = [
    "SMTP",
    "EMAIL_PASS",
    "password",
    "api_key",
    "apiKey",
    "expectedAnswer",
    "threshold",
    "breakdown",
  ];
  const leaks = forbidden.filter((term) => allHtml.toLowerCase().includes(term.toLowerCase()));
  log(
    "D1. No secrets/internal terms in templates",
    leaks.length === 0,
    leaks.length > 0 ? `found: ${leaks.join(", ")}` : "clean"
  );

  // ─── E. sendEmail failure safety ──────────────────────────────────
  clearSmtpEnv();
  let threw = false;
  let result;
  try {
    result = await sendEmail({
      to: "divya@example.com",
      subject: "test",
      html: "<p>hi</p>",
    });
  } catch {
    threw = true;
  }
  log(
    "E1. sendEmail without SMTP returns failure, never throws",
    !threw && result !== undefined && result.success === false,
    threw
      ? "threw!"
      : `result: ${result && result.success === false ? result.error : "unknown"}`
  );

  process.env.SMTP_USER = "smtp-user@example.com";
  process.env.SMTP_PASS = "dummy-password";
  let invalidThrew = false;
  let invalidResult;
  try {
    invalidResult = await sendEmail({
      to: "not-an-email",
      subject: "test",
      html: "<p>hi</p>",
    });
  } catch {
    invalidThrew = true;
  }
  log(
    "E2. sendEmail rejects invalid recipient without throwing",
    !invalidThrew &&
      invalidResult !== undefined &&
      invalidResult.success === false &&
      invalidResult.error === "Invalid recipient",
    invalidThrew
      ? "threw!"
      : `result: ${invalidResult && invalidResult.success === false ? invalidResult.error : "unknown"}`
  );
  clearSmtpEnv();

  log(
    "E3. isValidEmail / isEmailConfigured helpers",
    isValidEmail("a@b.co") && !isValidEmail("nope") && !isEmailConfigured(),
    `valid=${isValidEmail("a@b.co")} invalid=${isValidEmail("nope")} configured=${isEmailConfigured()}`
  );

  // ─── F. Idempotency lock fails open ───────────────────────────────
  delete process.env.REDIS_URL;
  const lock = await acquireNotificationLock("recrutva:notify:test:1");
  log(
    "F1. Notification lock fails open without Redis",
    lock === true,
    `acquireNotificationLock -> ${lock}`
  );

  // ─── Summary ──────────────────────────────────────────────────────
  console.log("═".repeat(64));
  const failed = results.filter((r) => r.s === "FAIL");
  for (const r of results) {
    console.log(`${r.s === "PASS" ? "✅" : "❌"} ${r.t}`);
  }
  console.log("═".repeat(64));
  console.log(
    `RESULT: ${results.length - failed.length}/${results.length} passed`
  );
  if (failed.length > 0) {
    console.log("FAILED:");
    failed.forEach((f) => console.log(`  ❌ ${f.t} — ${f.d}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Test harness error:", err);
  process.exitCode = 1;
});