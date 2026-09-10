"use server";

import { db } from "@/db";
import {
  applicants,
  jobs,
  pipelines,
  pipelineRounds,
  candidateRounds,
} from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, inArray, isNotNull, desc, sql } from "drizzle-orm";

/**
 * Recruiter dashboard overview.
 *
 * Every query here is scoped to the authenticated recruiter's Clerk userId
 * derived server-side from the session — never from a client-provided value.
 * All numbers are computed with database aggregation; no per-record data is
 * shipped to the client just to count things.
 */

export type PipelineStageType =
  | "RESUME_SCREENING"
  | "ASSESSMENT"
  | "AI_INTERVIEW"
  | "MANUAL_REVIEW";

export interface DashboardJobRow {
  id: number;
  title: string;
  status: string;
  location: string | null;
  createdAt: Date;
  applicantCount: number;
  activeCandidates: number;
  lastActivityAt: Date | null;
}

export interface DashboardActivityEvent {
  id: string;
  kind: "application" | "round";
  candidateName: string;
  /** Job title (for applications) or round name (for round completions). */
  detail: string;
  /** PASSED / FAILED for round events, null for applications. */
  status: string | null;
  at: Date;
}

export interface DashboardOverview {
  metrics: {
    totalJobs: number;
    activeJobs: number;
    totalCandidates: number;
    passedCandidates: number;
    rejectedCandidates: number;
  };
  pipelineStages: { type: PipelineStageType; count: number }[];
  jobs: DashboardJobRow[];
  recentActivity: DashboardActivityEvent[];
}

// Canonical display order for the pipeline stages.
const STAGE_ORDER: PipelineStageType[] = [
  "RESUME_SCREENING",
  "ASSESSMENT",
  "AI_INTERVIEW",
  "MANUAL_REVIEW",
];

// A candidate is "in" a stage while their round for it is ACTIVE or PENDING.
const IN_STAGE_STATUSES = ["ACTIVE", "PENDING"] as const;
const COMPLETED_ROUND_STATUSES = ["PASSED", "FAILED"] as const;

export async function getDashboardOverview(): Promise<DashboardOverview | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    // ─── 1. Job aggregates (total + open) ──────────────────────────
    const [jobsAgg] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${jobs.status} = 'Open')::int`,
      })
      .from(jobs)
      .where(eq(jobs.userId, userId));

    // ─── 2. Total candidates ───────────────────────────────────────
    const [applicantsAgg] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(applicants)
      .where(eq(applicants.userId, userId));

    // ─── 3. Passed / rejected candidates ───────────────────────────
    // Distinct candidates with at least one PASSED or FAILED round.
    const [roundsAgg] = await db
      .select({
        passed: sql<number>`count(distinct ${candidateRounds.candidateId}) filter (where ${candidateRounds.status} = 'PASSED')::int`,
        rejected: sql<number>`count(distinct ${candidateRounds.candidateId}) filter (where ${candidateRounds.status} = 'FAILED')::int`,
      })
      .from(candidateRounds)
      .innerJoin(applicants, eq(candidateRounds.candidateId, applicants.id))
      .where(eq(applicants.userId, userId));

    // ─── 4. Candidates currently in each pipeline stage ────────────
    // Scoped through candidates → rounds → pipeline → job → owner.
    const stageRows = await db
      .select({
        type: pipelineRounds.type,
        count: sql<number>`count(*)::int`,
      })
      .from(candidateRounds)
      .innerJoin(applicants, eq(candidateRounds.candidateId, applicants.id))
      .innerJoin(pipelineRounds, eq(candidateRounds.roundId, pipelineRounds.id))
      .innerJoin(pipelines, eq(pipelineRounds.pipelineId, pipelines.id))
      .innerJoin(jobs, eq(pipelines.jobId, jobs.id))
      .where(
        and(
          eq(applicants.userId, userId),
          eq(jobs.userId, userId),
          inArray(candidateRounds.status, [...IN_STAGE_STATUSES])
        )
      )
      .groupBy(pipelineRounds.type);

    // ─── 5. Job performance (per-job aggregates, no N+1) ───────────
    const jobRows = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        location: jobs.location,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(eq(jobs.userId, userId));

    // Applicant count + most recent application per job, in one grouped query.
    const applicantAggByJob = await db
      .select({
        jobId: applicants.targetJobId,
        applicantCount: sql<number>`count(*)::int`,
        lastActivityAt: sql<Date>`max(${applicants.createdAt})`,
      })
      .from(applicants)
      .where(
        and(eq(applicants.userId, userId), isNotNull(applicants.targetJobId))
      )
      .groupBy(applicants.targetJobId);

    // Active candidates per job (currently in a stage of that job's pipeline).
    const activeByJob = await db
      .select({
        jobId: pipelines.jobId,
        count: sql<number>`count(*)::int`,
      })
      .from(candidateRounds)
      .innerJoin(applicants, eq(candidateRounds.candidateId, applicants.id))
      .innerJoin(pipelineRounds, eq(candidateRounds.roundId, pipelineRounds.id))
      .innerJoin(pipelines, eq(pipelineRounds.pipelineId, pipelines.id))
      .innerJoin(jobs, eq(pipelines.jobId, jobs.id))
      .where(
        and(
          eq(applicants.userId, userId),
          eq(jobs.userId, userId),
          inArray(candidateRounds.status, [...IN_STAGE_STATUSES])
        )
      )
      .groupBy(pipelines.jobId);

    // ─── 6. Recent activity (existing timestamps only) ─────────────
    // New applications + completed rounds, merged and limited to 8.
    const recentApplicants = await db
      .select({
        id: applicants.id,
        name: applicants.name,
        jobTitle: applicants.jobTitle,
        createdAt: applicants.createdAt,
      })
      .from(applicants)
      .where(eq(applicants.userId, userId))
      .orderBy(desc(applicants.createdAt))
      .limit(8);

    const recentRounds = await db
      .select({
        candidateId: candidateRounds.candidateId,
        candidateName: applicants.name,
        roundName: pipelineRounds.name,
        status: candidateRounds.status,
        completedAt: candidateRounds.completedAt,
      })
      .from(candidateRounds)
      .innerJoin(applicants, eq(candidateRounds.candidateId, applicants.id))
      .innerJoin(pipelineRounds, eq(candidateRounds.roundId, pipelineRounds.id))
      .innerJoin(pipelines, eq(pipelineRounds.pipelineId, pipelines.id))
      .innerJoin(jobs, eq(pipelines.jobId, jobs.id))
      .where(
        and(
          eq(applicants.userId, userId),
          eq(jobs.userId, userId),
          inArray(candidateRounds.status, [...COMPLETED_ROUND_STATUSES]),
          isNotNull(candidateRounds.completedAt)
        )
      )
      .orderBy(desc(candidateRounds.completedAt))
      .limit(8);

    // ─── Assemble ──────────────────────────────────────────────────
    const appMap = new Map(
      applicantAggByJob.map((r) => [r.jobId, r] as const)
    );
    const activeMap = new Map(activeByJob.map((r) => [r.jobId, r.count] as const));

    const jobsData: DashboardJobRow[] = jobRows.map((j) => {
      const agg = appMap.get(j.id);
      return {
        ...j,
        applicantCount: agg?.applicantCount ?? 0,
        activeCandidates: activeMap.get(j.id) ?? 0,
        lastActivityAt: agg?.lastActivityAt
          ? new Date(agg.lastActivityAt)
          : null,
      };
    });

    const stageMap = new Map(stageRows.map((r) => [r.type, r.count] as const));
    const pipelineStages = STAGE_ORDER.map((type) => ({
      type,
      count: stageMap.get(type) ?? 0,
    }));

    const events: DashboardActivityEvent[] = [
      ...recentApplicants.map((a) => ({
        id: `application-${a.id}`,
        kind: "application" as const,
        candidateName: a.name,
        detail: a.jobTitle ?? "a job",
        status: null,
        at: a.createdAt,
      })),
      ...recentRounds.map((r) => ({
        id: `round-${r.candidateId}-${r.completedAt ? new Date(r.completedAt).getTime() : r.status}`,
        kind: "round" as const,
        candidateName: r.candidateName,
        detail: r.roundName,
        status: r.status,
        at: new Date(r.completedAt!),
      })),
    ];
    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    const recentActivity = events.slice(0, 8);

    return {
      metrics: {
        totalJobs: jobsAgg?.total ?? 0,
        activeJobs: jobsAgg?.active ?? 0,
        totalCandidates: applicantsAgg?.total ?? 0,
        passedCandidates: roundsAgg?.passed ?? 0,
        rejectedCandidates: roundsAgg?.rejected ?? 0,
      },
      pipelineStages,
      jobs: jobsData,
      recentActivity,
    };
  } catch (error) {
    console.error("Error fetching dashboard overview:", error);
    return null;
  }
}