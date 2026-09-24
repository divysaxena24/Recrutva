"use server";

import { db } from "@/db";
import { applicants, candidateRounds, pipelineRounds, pipelines, jobs } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, asc, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getNextPipelineRound } from "@/lib/pipeline-internal";
import {
  MoveCandidateToRoundSchema,
  UpdateCandidateRoundStatusSchema,
  CompleteCandidateRoundSchema,
} from "@/lib/schemas/actions";

// ─── Allowed statuses ─────────────────────────────────────────────
const ALLOWED_STATUSES = ["PENDING", "ACTIVE", "PASSED", "FAILED", "SKIPPED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

// ─── Helper: Verify recruiter ownership through the chain ─────────
async function verifyRecruiterOwnership(userId: string, targetJobId: number) {
  const [job] = await db
    .select({ userId: jobs.userId })
    .from(jobs)
    .where(eq(jobs.id, targetJobId))
    .limit(1);

  if (!job) {
    return { authorized: false, error: "Job not found" };
  }

  if (job.userId !== userId) {
    return { authorized: false, error: "Unauthorized: this candidate belongs to another recruiter's job" };
  }

  return { authorized: true };
}

// ─── Existing: Get Candidate Pipeline ─────────────────────────────
export async function getCandidatePipeline(candidateId: number) {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    // Fetch the candidate — scoped to the authenticated recruiter
    const [candidate] = await db
      .select({
        id: applicants.id,
        name: applicants.name,
        email: applicants.email,
        targetJobId: applicants.targetJobId,
        resumeUrl: applicants.resumeUrl,
        resumeText: applicants.resumeText,
        resumeFileName: applicants.resumeFileName,
      })
      .from(applicants)
      .where(and(eq(applicants.id, candidateId), eq(applicants.userId, userId)))
      .limit(1);

    if (!candidate) return null;

    if (!candidate.targetJobId) {
      return { candidate, rounds: [] };
    }

    // Find the pipeline for this candidate's job
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, candidate.targetJobId))
      .limit(1);

    if (!pipeline) {
      return { candidate, rounds: [] };
    }

    // Get all rounds for this pipeline, ordered
    const rounds = await db
      .select({
        id: pipelineRounds.id,
        name: pipelineRounds.name,
        type: pipelineRounds.type,
        order: pipelineRounds.order,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.pipelineId, pipeline.id))
      .orderBy(asc(pipelineRounds.order));

    // Get all candidate_rounds for this candidate
    const candidateRoundData = await db
      .select({
        id: candidateRounds.id,
        roundId: candidateRounds.roundId,
        status: candidateRounds.status,
        score: candidateRounds.score,
        feedback: candidateRounds.feedback,
        evaluation: candidateRounds.evaluation,
        startedAt: candidateRounds.startedAt,
        completedAt: candidateRounds.completedAt,
      })
      .from(candidateRounds)
      .where(eq(candidateRounds.candidateId, candidateId));

    // Create a lookup map for quick access
    const roundMap = new Map(
      candidateRoundData.map((cr) => [cr.roundId, cr])
    );

    // Merge pipeline rounds with candidate progress
    const roundsWithStatus = rounds.map((round) => {
      const candidateRound = roundMap.get(round.id);
      return {
        roundId: round.id,
        candidateRoundId: candidateRound?.id ?? null,
        name: round.name,
        type: round.type,
        order: round.order,
        status: candidateRound?.status ?? "NOT_STARTED",
        score: candidateRound?.score ?? null,
        feedback: candidateRound?.feedback ?? null,
        evaluation: candidateRound?.evaluation ?? null,
        startedAt: candidateRound?.startedAt ?? null,
        completedAt: candidateRound?.completedAt ?? null,
      };
    });

    return { candidate, rounds: roundsWithStatus };
  } catch (error) {
    console.error("Error fetching candidate pipeline:", error);
    return null;
  }
}

// ─── Move Candidate to a Specific Round ───────────────────────────
export async function moveCandidateToRound({
  candidateId,
  roundId,
}: {
  candidateId: number;
  roundId: number;
}) {
  try {
    const validation = MoveCandidateToRoundSchema.safeParse({ candidateId, roundId });
    if (!validation.success) {
      return { success: false, error: "Invalid input" };
    }

    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 1. Verify candidate exists
    const [candidate] = await db
      .select({
        id: applicants.id,
        targetJobId: applicants.targetJobId,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!candidate) {
      return { success: false, error: "Candidate not found" };
    }

    if (!candidate.targetJobId) {
      return { success: false, error: "Candidate is not linked to a job" };
    }

    // 2. Verify recruiter ownership
    const ownership = await verifyRecruiterOwnership(userId, candidate.targetJobId);
    if (!ownership.authorized) {
      return { success: false, error: ownership.error };
    }

    // 3. Verify the target round belongs to the pipeline of that job
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, candidate.targetJobId))
      .limit(1);

    if (!pipeline) {
      return { success: false, error: "No pipeline found for this job" };
    }

    const [targetRound] = await db
      .select({
        id: pipelineRounds.id,
        pipelineId: pipelineRounds.pipelineId,
        type: pipelineRounds.type,
        name: pipelineRounds.name,
        order: pipelineRounds.order,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, roundId))
      .limit(1);

    if (!targetRound || targetRound.pipelineId !== pipeline.id) {
      return { success: false, error: "Round does not belong to this job's pipeline" };
    }

    // 4. Check if candidate already has an ACTIVE round — deactivate it
    const [existingActive] = await db
      .select({ id: candidateRounds.id })
      .from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.status, "ACTIVE")
        )
      )
      .limit(1);

    if (existingActive && existingActive.id !== roundId) {
      // Complete the old active round as SKIPPED (preserve history)
      await db
        .update(candidateRounds)
        .set({
          status: "SKIPPED",
          completedAt: new Date(),
        })
        .where(eq(candidateRounds.id, existingActive.id));
    }

    // 5. Find or create the candidate_round record for the target round
    const [existingCandidateRound] = await db
      .select({ id: candidateRounds.id, status: candidateRounds.status })
      .from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.roundId, roundId)
        )
      )
      .limit(1);

    let resultRound;

    if (existingCandidateRound) {
      // Update existing record to ACTIVE
      const [updated] = await db
        .update(candidateRounds)
        .set({
          status: "ACTIVE",
          startedAt: existingCandidateRound.status === "PENDING" ? new Date() : undefined,
        })
        .where(eq(candidateRounds.id, existingCandidateRound.id))
        .returning();
      resultRound = updated;
    } else {
      // Create new candidate_round
      const [created] = await db
        .insert(candidateRounds)
        .values({
          candidateId,
          roundId,
          status: "ACTIVE",
          startedAt: new Date(),
        })
        .returning();
      resultRound = created;
    }

    // 6. Notifications (side effect — must never affect the transaction)
    try {
      const { notifyRoundActivated } = await import("@/lib/notifications");
      await notifyRoundActivated(
        candidateId,
        resultRound.id,
        targetRound.type
      );
    } catch (notifyError) {
      console.error("Error sending round-activated notification:", notifyError);
    }

    revalidatePath("/dashboard/candidates");

    return {
      success: true,
      data: {
        candidateRoundId: resultRound.id,
        roundId,
        status: "ACTIVE",
      },
    };
  } catch (error) {
    console.error("Error moving candidate to round:", error);
    return { success: false, error: "Failed to move candidate to round" };
  }
}

// ─── Update Candidate Round Status ────────────────────────────────
export async function updateCandidateRoundStatus({
  candidateRoundId,
  status,
  score,
  feedback,
  evaluation,
}: {
  candidateRoundId: number;
  status: AllowedStatus;
  score?: number | null;
  feedback?: string | null;
  evaluation?: Record<string, unknown> | null;
}) {
  try {
    const validation = UpdateCandidateRoundStatusSchema.safeParse({
      candidateRoundId,
      status,
      score,
      feedback,
      evaluation,
    });
    if (!validation.success) {
      return { success: false, error: "Invalid input" };
    }

    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 1. Validate status
    if (!ALLOWED_STATUSES.includes(status)) {
      return { success: false, error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` };
    }

    // 2. Fetch the candidate_round and verify ownership through the chain
    const [candidateRound] = await db
      .select({
        id: candidateRounds.id,
        status: candidateRounds.status,
        roundId: candidateRounds.roundId,
        startedAt: candidateRounds.startedAt,
        completedAt: candidateRounds.completedAt,
      })
      .from(candidateRounds)
      .where(eq(candidateRounds.id, candidateRoundId))
      .limit(1);

    if (!candidateRound) {
      return { success: false, error: "Candidate round not found" };
    }

    // 3. Verify ownership: candidate_round → pipeline_round → pipeline → job → job.userId
    const [pipelineRound] = await db
      .select({
        id: pipelineRounds.id,
        pipelineId: pipelineRounds.pipelineId,
        type: pipelineRounds.type,
        name: pipelineRounds.name,
        order: pipelineRounds.order,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, candidateRound.roundId))
      .limit(1);

    if (!pipelineRound) {
      return { success: false, error: "Pipeline round not found" };
    }

    const [pipeline] = await db
      .select({ jobId: pipelines.jobId })
      .from(pipelines)
      .where(eq(pipelines.id, pipelineRound.pipelineId))
      .limit(1);

    if (!pipeline) {
      return { success: false, error: "Pipeline not found" };
    }

    const ownership = await verifyRecruiterOwnership(userId, pipeline.jobId);
    if (!ownership.authorized) {
      return { success: false, error: ownership.error };
    }

    // 4. Build the update payload with only provided fields
    const updateData: Record<string, unknown> = { status };

    if (score !== undefined) updateData.score = score;
    if (feedback !== undefined) updateData.feedback = feedback;
    if (evaluation !== undefined) updateData.evaluation = evaluation;

    // 5. Handle timestamp logic
    if (status === "ACTIVE" && !candidateRound.startedAt) {
      updateData.startedAt = new Date();
    }

    if (["PASSED", "FAILED", "SKIPPED"].includes(status)) {
      updateData.completedAt = new Date();
    }

    // 6. Perform the update
    const [updated] = await db
      .update(candidateRounds)
      .set(updateData)
      .where(eq(candidateRounds.id, candidateRoundId))
      .returning();

    revalidatePath("/dashboard/candidates");

    return {
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        score: updated.score,
        feedback: updated.feedback,
        evaluation: updated.evaluation,
        startedAt: updated.startedAt,
        completedAt: updated.completedAt,
      },
    };
  } catch (error) {
    console.error("Error updating candidate round status:", error);
    return { success: false, error: "Failed to update candidate round status" };
  }
}

// ─── Complete a Candidate Round (PASSED/FAILED) ───────────────────
export async function completeCandidateRound({
  candidateRoundId,
  status,
  score,
  feedback,
  evaluation,
}: {
  candidateRoundId: number;
  status: "PASSED" | "FAILED";
  score?: number | null;
  feedback?: string | null;
  evaluation?: Record<string, unknown> | null;
}) {
  try {
    const validation = CompleteCandidateRoundSchema.safeParse({
      candidateRoundId,
      status,
      score,
      feedback,
      evaluation,
    });
    if (!validation.success) {
      return { success: false, error: "Invalid input" };
    }

    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 1. Validate status
    if (status !== "PASSED" && status !== "FAILED") {
      return { success: false, error: "Only PASSED or FAILED are accepted" };
    }

    // 2. Fetch the candidate_round
    const [candidateRound] = await db
      .select({
        id: candidateRounds.id,
        candidateId: candidateRounds.candidateId,
        roundId: candidateRounds.roundId,
        status: candidateRounds.status,
      })
      .from(candidateRounds)
      .where(eq(candidateRounds.id, candidateRoundId))
      .limit(1);

    if (!candidateRound) {
      return { success: false, error: "Candidate round not found" };
    }

    // 3. Verify ownership through the chain
    const [pipelineRound] = await db
      .select({
        id: pipelineRounds.id,
        pipelineId: pipelineRounds.pipelineId,
        type: pipelineRounds.type,
        name: pipelineRounds.name,
        order: pipelineRounds.order,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.id, candidateRound.roundId))
      .limit(1);

    if (!pipelineRound) {
      return { success: false, error: "Pipeline round not found" };
    }

    const [pipeline] = await db
      .select({ id: pipelines.id, jobId: pipelines.jobId })
      .from(pipelines)
      .where(eq(pipelines.id, pipelineRound.pipelineId))
      .limit(1);

    if (!pipeline) {
      return { success: false, error: "Pipeline not found" };
    }

    const ownership = await verifyRecruiterOwnership(userId, pipeline.jobId);
    if (!ownership.authorized) {
      return { success: false, error: ownership.error };
    }

    // 4. Update the current candidate_round
    const [updated] = await db
      .update(candidateRounds)
      .set({
        status,
        score: score ?? undefined,
        feedback: feedback ?? undefined,
        evaluation: evaluation ?? undefined,
        completedAt: new Date(),
      })
      .where(eq(candidateRounds.id, candidateRoundId))
      .returning();

    // 5. If PASSED, find and activate the next round
    let nextRoundActivated = false;
    let pipelineCompleted = false;
    let activatedNextRound: {
      id: number;
      name: string;
      type: string;
      order: number;
    } | null = null;

    if (status === "PASSED") {
      const nextRound = await getNextPipelineRound(
        pipelineRound.pipelineId,
        pipelineRound.order
      );
      activatedNextRound = nextRound;

      if (nextRound) {
        // Deactivate any existing ACTIVE round for this candidate (preserve history)
        const [currentActive] = await db
          .select({ id: candidateRounds.id })
          .from(candidateRounds)
          .where(
            and(
              eq(candidateRounds.candidateId, candidateRound.candidateId),
              eq(candidateRounds.status, "ACTIVE")
            )
          )
          .limit(1);

        if (currentActive) {
          await db
            .update(candidateRounds)
            .set({
              status: "SKIPPED",
              completedAt: new Date(),
            })
            .where(eq(candidateRounds.id, currentActive.id));
        }

        // Check if a candidate_round already exists for this next round
        const [existingNext] = await db
          .select({ id: candidateRounds.id })
          .from(candidateRounds)
          .where(
            and(
              eq(candidateRounds.candidateId, candidateRound.candidateId),
              eq(candidateRounds.roundId, nextRound.id)
            )
          )
          .limit(1);

        if (existingNext) {
          // Reactivate if it was previously started
          await db
            .update(candidateRounds)
            .set({
              status: "ACTIVE",
              startedAt: new Date(),
            })
            .where(eq(candidateRounds.id, existingNext.id));
        } else {
          // Create a new candidate_round for the next round
          await db.insert(candidateRounds).values({
            candidateId: candidateRound.candidateId,
            roundId: nextRound.id,
            status: "ACTIVE",
            startedAt: new Date(),
          });
        }

        nextRoundActivated = true;
      } else {
        // No next round — pipeline completed
        pipelineCompleted = true;
      }
    }

    // 6. Notifications (side effect — must never affect the transaction).
    // The recruiter performed this completion themselves, so they do not get
    // a "completed" email about their own action.
    try {
      const { notifyRoundCompleted } = await import("@/lib/notifications");
      await notifyRoundCompleted({
        candidateId: candidateRound.candidateId,
        candidateRoundId: candidateRound.id,
        round: {
          id: pipelineRound.id,
          type: pipelineRound.type,
          name: pipelineRound.name,
        },
        status,
        score: score ?? null,
        activatedRound: activatedNextRound,
        notifyRecruiterCompletion: false,
      });
    } catch (notifyError) {
      console.error("Error sending round-completion notification:", notifyError);
    }

    revalidatePath("/dashboard/candidates");

    return {
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        score: updated.score,
        feedback: updated.feedback,
        evaluation: updated.evaluation,
        startedAt: updated.startedAt,
        completedAt: updated.completedAt,
        nextRoundActivated,
        pipelineCompleted,
      },
    };
  } catch (error) {
    console.error("Error completing candidate round:", error);
    return { success: false, error: "Failed to complete candidate round" };
  }
}

// ─── Setup / Update Custom Job Pipeline Rounds ───────────────────
export async function setupJobPipeline(
  jobId: number,
  customRounds: Array<{
    name: string;
    type: string;
    configuration?: Record<string, unknown>;
  }>
) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  try {
    const ownership = await verifyRecruiterOwnership(userId, jobId);
    if (!ownership.authorized) return { success: false, error: ownership.error };

    // Find or create pipeline
    let [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, jobId))
      .limit(1);

    if (!pipeline) {
      const [job] = await db.select({ title: jobs.title }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
      const [newPipe] = await db
        .insert(pipelines)
        .values({
          jobId,
          name: `${job?.title ?? "Job"} Pipeline`,
        })
        .returning();
      pipeline = newPipe;
    }

    // Delete existing rounds if updating rounds setup
    await db.delete(pipelineRounds).where(eq(pipelineRounds.pipelineId, pipeline.id));

    // Insert new rounds
    const roundsToInsert = customRounds.map((r, index) => ({
      pipelineId: pipeline.id,
      name: r.name,
      type: r.type,
      order: index + 1,
      configuration: r.configuration ?? {},
    }));

    if (roundsToInsert.length > 0) {
      await db.insert(pipelineRounds).values(roundsToInsert);
    }

    revalidatePath(`/dashboard/jobs/${jobId}/candidates`);
    return { success: true };
  } catch (error) {
    console.error("Error setting up job pipeline:", error);
    return { success: false, error: "Failed to setup job pipeline" };
  }
}

// ─── Get Job-Specific Pipeline Overview (Analytics + Table + Pipeline) ─
export async function getJobPipelineOverview(jobId: number) {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    // 1. Verify job ownership
    const [jobData] = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        requirements: jobs.requirements,
        location: jobs.location,
        status: jobs.status,
        department: jobs.department,
        employmentType: jobs.employmentType,
        experience: jobs.experience,
        workMode: jobs.workMode,
        salaryRange: jobs.salaryRange,
        summary: jobs.summary,
        responsibilities: jobs.responsibilities,
        requiredSkills: jobs.requiredSkills,
        preferredSkills: jobs.preferredSkills,
        qualifications: jobs.qualifications,
        benefits: jobs.benefits,
        createdAt: jobs.createdAt,
        userId: jobs.userId,
      })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
      .limit(1);

    if (!jobData) return null;

    // 2. Ensure pipeline exists
    let [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, jobId))
      .limit(1);

    if (!pipeline) {
      const [newPipe] = await db
        .insert(pipelines)
        .values({
          jobId,
          name: `${jobData.title} Pipeline`,
        })
        .returning();
      pipeline = newPipe;

      // Default 3 rounds if none configured
      await db.insert(pipelineRounds).values([
        {
          pipelineId: pipeline.id,
          name: "Resume Screening",
          type: "RESUME_SCREENING",
          order: 1,
          configuration: { passThreshold: 70, selectTarget: "80%" },
        },
        {
          pipelineId: pipeline.id,
          name: "Technical OA",
          type: "ASSESSMENT",
          order: 2,
          configuration: { passThreshold: 70, selectTarget: "70%" },
        },
        {
          pipelineId: pipeline.id,
          name: "AI Tech Interview",
          type: "AI_INTERVIEW",
          order: 3,
          configuration: { passThreshold: 75, selectTarget: "60%" },
        },
      ]);
    }

    // 3. Fetch rounds
    const rounds = await db
      .select({
        id: pipelineRounds.id,
        name: pipelineRounds.name,
        type: pipelineRounds.type,
        order: pipelineRounds.order,
        configuration: pipelineRounds.configuration,
      })
      .from(pipelineRounds)
      .where(eq(pipelineRounds.pipelineId, pipeline.id))
      .orderBy(asc(pipelineRounds.order));

    // 4. Fetch candidates for this specific job
    const candidateRows = await db
      .select({
        id: applicants.id,
        name: applicants.name,
        email: applicants.email,
        phone: applicants.phone,
        status: applicants.status,
        score: applicants.score,
        matchScore: applicants.matchScore,
        jobTitle: applicants.jobTitle,
        targetJobId: applicants.targetJobId,
        resumeUrl: applicants.resumeUrl,
        resumeFileName: applicants.resumeFileName,
        resumeText: applicants.resumeText,
        createdAt: applicants.createdAt,
      })
      .from(applicants)
      .where(and(eq(applicants.targetJobId, jobId), eq(applicants.userId, userId)));

    const candidateIds = candidateRows.map((c) => c.id);

    // 5. Fetch candidate_rounds for these candidates
    let candidateRoundRows: Array<{
      id: number;
      candidateId: number;
      roundId: number;
      status: string;
      score: number | null;
      feedback: string | null;
      completedAt: Date | null;
    }> = [];

    if (candidateIds.length > 0) {
      candidateRoundRows = await db
        .select({
          id: candidateRounds.id,
          candidateId: candidateRounds.candidateId,
          roundId: candidateRounds.roundId,
          status: candidateRounds.status,
          score: candidateRounds.score,
          feedback: candidateRounds.feedback,
          completedAt: candidateRounds.completedAt,
        })
        .from(candidateRounds)
        .where(inArray(candidateRounds.candidateId, candidateIds));
    }

    // Map candidate rounds by roundId & candidateId
    const crByCandidate = new Map<number, typeof candidateRoundRows>();
    for (const cr of candidateRoundRows) {
      const list = crByCandidate.get(cr.candidateId) ?? [];
      list.push(cr);
      crByCandidate.set(cr.candidateId, list);
    }

    // Build enriched candidates list for Table View
    const allCandidates = candidateRows.map((c) => {
      const crs = crByCandidate.get(c.id) ?? [];
      const crByRound = new Map(crs.map((cr) => [cr.roundId, cr]));

      let currentStageName = "Not started";
      let currentStageType = "not-started";
      let currentStageStatus = "PENDING";

      for (const r of rounds) {
        const cr = crByRound.get(r.id);
        if (cr && (cr.status === "ACTIVE" || cr.status === "PASSED")) {
          currentStageName = r.name;
          currentStageType = r.type;
          currentStageStatus = cr.status;
        }
      }

      // Convert matchScore string or float to clean integer
      const atsScoreNum = c.matchScore
        ? Math.round(parseFloat(c.matchScore))
        : null;

      return {
        ...c,
        atsScore: atsScoreNum,
        currentStageName,
        currentStageType,
        currentStageStatus,
      };
    });

    // Build Pipeline View rounds analytics + candidate arrays
    const candidateMap = new Map(allCandidates.map((c) => [c.id, c]));

    const pipelineRoundsOverview = rounds.map((r) => {
      const roundCRs = candidateRoundRows.filter((cr) => cr.roundId === r.id);
      
      const passedCandidates = roundCRs
        .filter((cr) => cr.status === "PASSED" || cr.status === "ACTIVE")
        .map((cr) => {
          const cand = candidateMap.get(cr.candidateId);
          return {
            ...cand,
            roundScore: cr.score,
            roundStatus: cr.status,
            roundFeedback: cr.feedback,
          };
        })
        .filter(Boolean);

      const failedCandidates = roundCRs
        .filter((cr) => cr.status === "FAILED")
        .map((cr) => {
          const cand = candidateMap.get(cr.candidateId);
          return {
            ...cand,
            roundScore: cr.score,
            roundStatus: cr.status,
            roundFeedback: cr.feedback,
          };
        })
        .filter(Boolean);

      const evaluatedCount = roundCRs.length;
      const passedCount = passedCandidates.length;
      const failedCount = failedCandidates.length;

      const passPercentage =
        evaluatedCount > 0 ? Math.round((passedCount / evaluatedCount) * 100) : 0;

      return {
        id: r.id,
        name: r.name,
        type: r.type,
        order: r.order,
        configuration: r.configuration as Record<string, unknown>,
        stats: {
          evaluatedCount,
          passedCount,
          failedCount,
          passPercentage,
        },
        passedCandidates,
        failedCandidates,
      };
    });

    return {
      job: jobData,
      rounds: pipelineRoundsOverview,
      allCandidates,
    };
  } catch (error) {
    console.error("Error getting job pipeline overview:", error);
    return null;
  }
}
