"use server";

import { db } from "@/db";
import {
  applicants,
  pipelines,
  pipelineRounds,
  candidateRounds,
} from "@/db/schema";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

/**
 * Candidate dashboard — application overview with pipeline progress.
 *
 * Identity is derived server-side from the Clerk session (the candidate's
 * email address). A client can never pass a candidate/userId. Only data that
 * is safe for the candidate to see is returned: stage types/names/statuses,
 * human-readable labels, and the next action. Internal values (expected
 * answers, grading criteria, recruiter feedback, evaluations, raw enums) are
 * never shipped to the client.
 */

export type StageState =
  | "completed"
  | "current"
  | "upcoming"
  | "failed"
  | "skipped"
  | "not-available";

export type StatusTone = "emerald" | "indigo" | "amber" | "rose" | "purple" | "slate";

export interface CandidateStageView {
  /** Pipeline round type (e.g. RESUME_SCREENING) or "application" / "decision" for bookends. */
  type: string;
  /** Candidate-facing stage name. */
  name: string;
  status: StageState;
}

export type NextActionKind =
  | "assessment"
  | "interview"
  | "manual-review"
  | "in-review"
  | "complete"
  | "not-progressing"
  | "missed";

export interface CandidateNextAction {
  kind: NextActionKind;
  label: string;
  description: string;
  /** Route for the candidate to take the action, or null when waiting/passive. */
  href: string | null;
}

export interface CandidateApplicationView {
  id: number;
  jobTitle: string;
  jobId: number | null;
  /** Human-readable overall application status. */
  status: string;
  statusTone: StatusTone;
  createdAt: Date;
  scheduledAt: Date | null;
  /** AI interview score (candidate-visible by design, e.g. on the result page). */
  score: string | null;
  /** Pipeline stages including Application (first) and Decision (last) bookends. */
  stages: CandidateStageView[];
  /** 0–100 progress across the candidate's actual pipeline rounds. */
  progressPercent: number;
  nextAction: CandidateNextAction;
}

const STAGE_LABELS: Record<string, string> = {
  RESUME_SCREENING: "Resume Screening",
  ASSESSMENT: "Assessment",
  AI_INTERVIEW: "AI Interview",
  MANUAL_REVIEW: "Manual Review",
};

function friendlyStageName(type: string, configuredName: string | null): string {
  return STAGE_LABELS[type] ?? configuredName ?? "Stage";
}

export async function getCandidateApplications(): Promise<CandidateApplicationView[]> {
  const user = await currentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return [];

  try {
    // ─── 1. All applications for this candidate (by email) ──────────
    const apps = await db
      .select({
        id: applicants.id,
        jobTitle: applicants.jobTitle,
        targetJobId: applicants.targetJobId,
        status: applicants.status,
        createdAt: applicants.createdAt,
        scheduledAt: applicants.scheduledAt,
        score: applicants.score,
      })
      .from(applicants)
      .where(eq(applicants.email, email))
      .orderBy(desc(applicants.createdAt));

    if (apps.length === 0) return [];

    const candidateIds = apps.map((a) => a.id);
    const jobIds = apps
      .map((a) => a.targetJobId)
      .filter((id): id is number => id !== null);

    // ─── 2. Pipelines + rounds for those jobs (bulk, no N+1) ────────
    let pipelineRows: { id: number; jobId: number }[] = [];
    let roundRows: {
      id: number;
      pipelineId: number;
      name: string | null;
      type: string;
      order: number;
    }[] = [];

    if (jobIds.length > 0) {
      pipelineRows = await db
        .select({ id: pipelines.id, jobId: pipelines.jobId })
        .from(pipelines)
        .where(inArray(pipelines.jobId, jobIds));

      const pipelineIds = pipelineRows.map((p) => p.id);
      if (pipelineIds.length > 0) {
        roundRows = await db
          .select({
            id: pipelineRounds.id,
            pipelineId: pipelineRounds.pipelineId,
            name: pipelineRounds.name,
            type: pipelineRounds.type,
            order: pipelineRounds.order,
          })
          .from(pipelineRounds)
          .where(inArray(pipelineRounds.pipelineId, pipelineIds))
          .orderBy(asc(pipelineRounds.order));
      }
    }

    // ─── 3. Candidate's round progress (bulk) ───────────────────────
    const candidateRoundRows = await db
      .select({
        candidateId: candidateRounds.candidateId,
        roundId: candidateRounds.roundId,
        status: candidateRounds.status,
      })
      .from(candidateRounds)
      .where(inArray(candidateRounds.candidateId, candidateIds));

    const roundsByPipeline = new Map<number, typeof roundRows>();
    for (const round of roundRows) {
      const list = roundsByPipeline.get(round.pipelineId) ?? [];
      list.push(round);
      roundsByPipeline.set(round.pipelineId, list);
    }

    const roundStatusMap = new Map<string, string>();
    for (const cr of candidateRoundRows) {
      roundStatusMap.set(`${cr.candidateId}:${cr.roundId}`, cr.status);
    }

    const pipelineByJob = new Map(pipelineRows.map((p) => [p.jobId, p.id]));

    const now = Date.now();

    // ─── 4. Assemble per-application view ────────────────────────────
    return apps.map((app) => {
      // Replicate the existing smart status derivation (Missed / Scheduled).
      let appStatus = app.status;
      if (appStatus !== "Completed" && app.scheduledAt) {
        if (new Date(app.scheduledAt).getTime() < now) {
          appStatus = "Missed";
        } else if (appStatus === "Ready") {
          appStatus = "Scheduled";
        }
      }

      const pipelineId = app.targetJobId
        ? pipelineByJob.get(app.targetJobId)
        : undefined;
      const rounds = pipelineId ? (roundsByPipeline.get(pipelineId) ?? []) : [];

      // Derive per-round state, respecting the actual pipeline order.
      let blocked = false;
      const roundStages: CandidateStageView[] = rounds.map((round) => {
        const crStatus = roundStatusMap.get(`${app.id}:${round.id}`);
        let status: StageState;

        if (!crStatus || crStatus === "PENDING") {
          status = blocked ? "not-available" : "upcoming";
        } else {
          switch (crStatus) {
            case "PASSED":
              status = "completed";
              break;
            case "FAILED":
              status = "failed";
              blocked = true;
              break;
            case "ACTIVE":
              status = "current";
              break;
            case "SKIPPED":
              status = "skipped";
              break;
            default:
              status = blocked ? "not-available" : "upcoming";
          }
        }

        return {
          type: round.type,
          name: friendlyStageName(round.type, round.name),
          status,
        };
      });

      const hasFailed = roundStages.some((s) => s.status === "failed");
      const completedCount = roundStages.filter(
        (s) => s.status === "completed" || s.status === "skipped"
      ).length;
      const progressPercent =
        roundStages.length > 0
          ? Math.round((completedCount / roundStages.length) * 100)
          : 0;

      // Overall human-readable status.
      const statusInfo = deriveStatus(appStatus, roundStages, app.status);

      // "What's next?" — the primary action for this application.
      const nextAction = deriveNextAction(app.id, appStatus, roundStages);

      // Stage bookends: Application (always completed) + Decision.
      const decisionStatus: StageState = hasFailed
        ? "failed"
        : roundStages.length > 0 &&
            roundStages.every(
              (s) => s.status === "completed" || s.status === "skipped"
            )
          ? "current"
          : "upcoming";

      const stages: CandidateStageView[] = [
        { type: "application", name: "Application", status: "completed" },
        ...roundStages,
        { type: "decision", name: "Decision", status: decisionStatus },
      ];

      return {
        id: app.id,
        jobTitle: app.jobTitle ?? "Application",
        jobId: app.targetJobId,
        status: statusInfo.label,
        statusTone: statusInfo.tone,
        createdAt: app.createdAt,
        scheduledAt: app.scheduledAt,
        score: app.score,
        stages,
        progressPercent,
        nextAction,
      };
    });
  } catch (error) {
    console.error("Error fetching candidate applications:", error);
    return [];
  }
}

function deriveStatus(
  appStatus: string,
  roundStages: CandidateStageView[],
  rawStatus: string
): { label: string; tone: StatusTone } {
  if (roundStages.some((s) => s.status === "failed")) {
    return { label: "Application Not Progressing", tone: "rose" };
  }
  if (appStatus === "Missed") {
    return { label: "Interview Missed", tone: "rose" };
  }

  const current = roundStages.find((s) => s.status === "current");
  if (current) {
    switch (current.type) {
      case "RESUME_SCREENING":
        return { label: "Application In Review", tone: "amber" };
      case "ASSESSMENT":
        return { label: "Assessment In Progress", tone: "amber" };
      case "AI_INTERVIEW":
        return { label: "Interview In Progress", tone: "indigo" };
      case "MANUAL_REVIEW":
        return { label: "Under Review", tone: "purple" };
      default:
        return { label: "In Progress", tone: "indigo" };
    }
  }

  if (appStatus === "Scheduled") {
    return { label: "Interview Scheduled", tone: "indigo" };
  }

  if (
    roundStages.length > 0 &&
    roundStages.every((s) => s.status === "completed" || s.status === "skipped")
  ) {
    return { label: "Application Complete", tone: "emerald" };
  }

  if (rawStatus === "Completed") {
    return { label: "Interview Completed", tone: "indigo" };
  }

  return {
    label: "Application Received",
    tone: "amber",
  };
}

function deriveNextAction(
  applicationId: number,
  appStatus: string,
  roundStages: CandidateStageView[]
): CandidateNextAction {
  if (roundStages.some((s) => s.status === "failed")) {
    return {
      kind: "not-progressing",
      label: "Application Not Progressing",
      description: "Your application is no longer progressing.",
      href: null,
    };
  }
  if (appStatus === "Missed") {
    return {
      kind: "missed",
      label: "Interview Missed",
      description:
        "You missed your scheduled interview. Please reach out to the recruiter if you believe this is a mistake.",
      href: null,
    };
  }

  const current = roundStages.find((s) => s.status === "current");
  if (current) {
    switch (current.type) {
      case "ASSESSMENT":
        return {
          kind: "assessment",
          label: "Complete Your Assessment",
          description:
            "Your assessment is ready. Complete it to keep moving forward.",
          href: `/assessment/${applicationId}`,
        };
      case "AI_INTERVIEW":
        return {
          kind: "interview",
          label: "Start Your AI Interview",
          description:
            "Your AI interview is ready. Find a quiet place and begin.",
          href: `/interview/${applicationId}`,
        };
      case "MANUAL_REVIEW":
        return {
          kind: "manual-review",
          label: "Under Recruiter Review",
          description: "Your application is under recruiter review.",
          href: null,
        };
      case "RESUME_SCREENING":
      default:
        return {
          kind: "in-review",
          label: "Application Being Reviewed",
          description: "Your application is being reviewed.",
          href: null,
        };
    }
  }

  // Legacy fallback: pipeline round may lag behind the scheduled interview.
  if (appStatus === "Scheduled") {
    return {
      kind: "interview",
      label: "Start Your AI Interview",
      description:
        "Your AI interview is ready. Find a quiet place and begin.",
      href: `/interview/${applicationId}`,
    };
  }

  if (
    roundStages.length > 0 &&
    roundStages.every((s) => s.status === "completed" || s.status === "skipped")
  ) {
    return {
      kind: "complete",
      label: "Application Complete",
      description: "Your application process is complete.",
      href: null,
    };
  }

  return {
    kind: "in-review",
    label: "Application Being Reviewed",
    description: "Your application is being reviewed.",
    href: null,
  };
}