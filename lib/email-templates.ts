import "server-only";
import { buildBrandedEmailHtml, getAppUrl } from "./email";

/**
 * Recrutva transactional email templates.
 *
 * Every template:
 * - uses NEXT_PUBLIC_APP_URL (via getAppUrl) for links — never hardcoded hosts
 * - contains Recrutva branding, a clear subject, a greeting, one primary CTA
 *   where applicable, and a fallback plain URL
 * - never includes internal evaluation data, expected answers, grading
 *   criteria, recruiter notes, or other sensitive internals
 */

export interface TemplateEmail {
  subject: string;
  html: string;
}

interface CandidateEmailInput {
  candidateName: string;
  jobTitle: string;
  candidateId: number;
}

function fallbackLink(url: string): string {
  return `If the button doesn't work, open this link: <a href="${url}" style="color:#3D6EFA;text-decoration:none;">${url}</a>`;
}

// ─── Candidate: Assessment Available ───────────────────────────────

export function buildAssessmentAvailableEmail(
  input: CandidateEmailInput
): TemplateEmail {
  const assessmentUrl = `${getAppUrl()}/assessment/${input.candidateId}`;
  return {
    subject: `Your assessment is ready — ${input.jobTitle}`,
    html: buildBrandedEmailHtml({
      heading: "Assessment Ready",
      title: "Your assessment is ready",
      greeting: `Hello ${input.candidateName},`,
      introHtml: `Great news — you've moved forward in the hiring process for <strong style="color:#7fa0ff;">${input.jobTitle}</strong>. Your skills assessment is now available to complete.`,
      cta: { label: "Start Assessment", url: assessmentUrl },
      noteHtml: fallbackLink(assessmentUrl),
      footerNote: "Complete your assessment to keep your application moving.",
    }),
  };
}

// ─── Candidate: AI Interview Available ─────────────────────────────

export function buildInterviewAvailableEmail(
  input: CandidateEmailInput
): TemplateEmail {
  const interviewUrl = `${getAppUrl()}/interview/${input.candidateId}`;
  return {
    subject: `Your AI interview is ready — ${input.jobTitle}`,
    html: buildBrandedEmailHtml({
      heading: "Interview Ready",
      title: "Your AI interview is ready",
      greeting: `Hello ${input.candidateName},`,
      introHtml: `You've been invited to complete your AI screening interview for <strong style="color:#7fa0ff;">${input.jobTitle}</strong>. Find a quiet place and allow around 15–20 minutes.`,
      cta: { label: "Start Interview", url: interviewUrl },
      noteHtml: fallbackLink(interviewUrl),
      footerNote: "You have one attempt, so take your time.",
    }),
  };
}

// ─── Candidate: Stage Passed ───────────────────────────────────────

export function buildStagePassedEmail(input: {
  candidateName: string;
  jobTitle: string;
  stageName: string;
  nextStep: string;
}): TemplateEmail {
  return {
    subject: `Update on your application — ${input.jobTitle}`,
    html: buildBrandedEmailHtml({
      heading: "Application Update",
      title: "Great news — you've passed a stage!",
      greeting: `Hello ${input.candidateName},`,
      introHtml: `You've successfully completed the <strong style="color:#7fa0ff;">${input.stageName}</strong> stage for <strong style="color:#7fa0ff;">${input.jobTitle}</strong>.`,
      noteHtml: `<span style="color:#8A93A8;">${input.nextStep}</span>`,
      footerNote: "You'll hear from us about the next steps.",
    }),
  };
}

// ─── Candidate: Application Not Progressing ────────────────────────

export function buildNotProgressingEmail(input: {
  candidateName: string;
  jobTitle: string;
  stageName: string;
}): TemplateEmail {
  return {
    subject: `Update on your application — ${input.jobTitle}`,
    html: buildBrandedEmailHtml({
      heading: "Application Update",
      title: "An update on your application",
      greeting: `Hello ${input.candidateName},`,
      introHtml: `Thank you for your interest in <strong style="color:#7fa0ff;">${input.jobTitle}</strong> and for the time you invested in the application process. After careful review, we won't be moving forward with your application for this role at this stage.`,
      noteHtml:
        "We appreciate your interest and encourage you to apply for future roles that match your profile.",
      footerNote: "This decision does not affect other applications you may have with us.",
    }),
  };
}

// ─── Recruiter: New Candidate ──────────────────────────────────────

export function buildRecruiterNewCandidateEmail(input: {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  candidatesUrl: string;
}): TemplateEmail {
  return {
    subject: `New candidate for ${input.jobTitle}`,
    html: buildBrandedEmailHtml({
      heading: "New Application",
      title: "A new candidate has applied",
      greeting: "Hello,",
      introHtml: `<strong style="color:#EDF0F7;">${input.candidateName}</strong> (${input.candidateEmail}) has applied for <strong style="color:#7fa0ff;">${input.jobTitle}</strong>.`,
      cta: { label: "View Candidate", url: input.candidatesUrl },
      noteHtml: fallbackLink(input.candidatesUrl),
      footerNote: "Review the application to keep your pipeline moving.",
    }),
  };
}

// ─── Recruiter: Manual Review Required ─────────────────────────────

export function buildRecruiterManualReviewEmail(input: {
  candidateName: string;
  jobTitle: string;
  reviewUrl: string;
}): TemplateEmail {
  return {
    subject: `Candidate requires review — ${input.jobTitle}`,
    html: buildBrandedEmailHtml({
      heading: "Manual Review",
      title: "A candidate is waiting for your review",
      greeting: "Hello,",
      introHtml: `<strong style="color:#EDF0F7;">${input.candidateName}</strong> has reached the manual review stage for <strong style="color:#7fa0ff;">${input.jobTitle}</strong>. Their results are ready for you to evaluate.`,
      cta: { label: "Review Candidate", url: input.reviewUrl },
      noteHtml: fallbackLink(input.reviewUrl),
      footerNote: "Candidates at this stage are waiting on your decision.",
    }),
  };
}

// ─── Recruiter: Assessment Completed ───────────────────────────────

export function buildRecruiterAssessmentCompletedEmail(input: {
  candidateName: string;
  jobTitle: string;
  score: number | null;
  reviewUrl: string;
}): TemplateEmail {
  return {
    subject: `Assessment completed — ${input.candidateName}`,
    html: buildBrandedEmailHtml({
      heading: "Assessment Completed",
      title: "A candidate has completed their assessment",
      greeting: "Hello,",
      introHtml: `<strong style="color:#EDF0F7;">${input.candidateName}</strong> has completed the assessment for <strong style="color:#7fa0ff;">${input.jobTitle}</strong>.${
        input.score !== null ? ` Their score is <strong style="color:#7fa0ff;">${input.score}</strong>.` : ""
      }`,
      cta: { label: "View Candidate", url: input.reviewUrl },
      noteHtml: fallbackLink(input.reviewUrl),
      footerNote: "Scores shown are the recruiter-facing assessment result.",
    }),
  };
}

// ─── Recruiter: AI Interview Completed ─────────────────────────────

export function buildRecruiterInterviewCompletedEmail(input: {
  candidateName: string;
  jobTitle: string;
  score: number | null;
  reviewUrl: string;
}): TemplateEmail {
  return {
    subject: `AI interview completed — ${input.candidateName}`,
    html: buildBrandedEmailHtml({
      heading: "Interview Completed",
      title: "A candidate has completed their AI interview",
      greeting: "Hello,",
      introHtml: `<strong style="color:#EDF0F7;">${input.candidateName}</strong> has completed their AI interview for <strong style="color:#7fa0ff;">${input.jobTitle}</strong>.${
        input.score !== null ? ` Their score is <strong style="color:#7fa0ff;">${input.score}</strong>.` : ""
      }`,
      cta: { label: "View Candidate", url: input.reviewUrl },
      noteHtml: fallbackLink(input.reviewUrl),
      footerNote: "The full evaluation is available in your dashboard.",
    }),
  };
}