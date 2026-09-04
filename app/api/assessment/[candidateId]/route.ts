import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  applicants,
  candidateRounds,
  pipelineRounds,
  pipelines,
  jobs,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { generateAssessmentQuestions } from "@/lib/assessment";
import { parseAssessmentConfig } from "@/lib/schemas/assessment";
import type { AssessmentQuestions } from "@/lib/schemas/assessment";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId: candidateIdStr } = await params;
    const candidateId = parseInt(candidateIdStr, 10);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { error: "Invalid candidate ID" },
        { status: 400 }
      );
    }

    // 1. Find the candidate
    const [candidate] = await db
      .select({
        id: applicants.id,
        userId: applicants.userId,
        email: applicants.email,
        targetJobId: applicants.targetJobId,
        resumeText: applicants.resumeText,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    // 2. Auth check: verify this is the candidate or their recruiter
    const { userId } = await auth();
    const user = await currentUser();
    const candidateEmail = user?.emailAddresses?.[0]?.emailAddress;

    const isRecruiter = userId && candidate.userId === userId;
    const isCandidate =
      candidateEmail && candidate.email === candidateEmail;

    if (!isRecruiter && !isCandidate) {
      return NextResponse.json(
        { error: "You do not have access to this assessment" },
        { status: 403 }
      );
    }

    // 3. Rate limit — BEFORE the expensive question generation Groq call
    const blocked = await rateLimitOrReject(
      req,
      { endpoint: "assessment-load", limit: 10, windowSeconds: 600 },
      userId,
    );
    if (blocked) return blocked;

    if (!candidate.targetJobId) {
      return NextResponse.json(
        { error: "Candidate is not linked to a job" },
        { status: 400 }
      );
    }

    // 4. Find the pipeline and ASSESSMENT round
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.jobId, candidate.targetJobId))
      .limit(1);

    if (!pipeline) {
      return NextResponse.json(
        { error: "No pipeline found for this job" },
        { status: 400 }
      );
    }

    const [assessmentRound] = await db
      .select({
        id: pipelineRounds.id,
        configuration: pipelineRounds.configuration,
      })
      .from(pipelineRounds)
      .where(
        and(
          eq(pipelineRounds.pipelineId, pipeline.id),
          eq(pipelineRounds.type, "ASSESSMENT")
        )
      )
      .limit(1);

    if (!assessmentRound) {
      return NextResponse.json(
        { error: "No ASSESSMENT round found in pipeline" },
        { status: 400 }
      );
    }

    // 5. Find the candidate_round for this assessment
    const [candidateRound] = await db
      .select({
        id: candidateRounds.id,
        status: candidateRounds.status,
        score: candidateRounds.score,
        evaluation: candidateRounds.evaluation,
      })
      .from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.roundId, assessmentRound.id)
        )
      )
      .limit(1);

    if (!candidateRound) {
      return NextResponse.json(
        { error: "Candidate is not enrolled in the assessment round" },
        { status: 400 }
      );
    }

    // 6. If already completed, return the result (no re-generation)
    if (
      candidateRound.status === "PASSED" ||
      candidateRound.status === "FAILED"
    ) {
      const evalData = candidateRound.evaluation as Record<string, unknown> | null;
      return NextResponse.json({
        success: true,
        completed: true,
        status: candidateRound.status,
        score: candidateRound.evaluation
          ? (evalData as Record<string, unknown>)?.percentage ?? candidateRound.score
          : candidateRound.score,
        evaluation: candidateRound.evaluation,
        questions: null, // Don't re-send questions for completed assessments
      });
    }

    // 7. Check if questions already exist in the evaluation field
    const evalData = candidateRound.evaluation as Record<string, unknown> | null;
    if (evalData && Array.isArray(evalData.questions) && evalData.questions.length > 0) {
      // Return existing questions (candidate refreshed the page)
      const safeQuestions = (evalData.questions as Array<Record<string, unknown>>).map(
        (q) => ({
          id: q.id,
          question: q.question,
          type: q.type,
          maxMarks: q.maxMarks,
          // Never expose expectedAnswer
        })
      );

      return NextResponse.json({
        success: true,
        completed: false,
        questions: safeQuestions,
        answers: evalData.answers ?? {},
      });
    }

    // 8. Generate questions (first time)
    const config = parseAssessmentConfig(
      assessmentRound.configuration as Record<string, unknown> | null
    );

    const [job] = await db
      .select({
        title: jobs.title,
        description: jobs.description,
        requirements: jobs.requirements,
      })
      .from(jobs)
      .where(eq(jobs.id, candidate.targetJobId))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 400 });
    }

    const questionResult = await generateAssessmentQuestions({
      candidateId,
      jobTitle: job.title,
      jobDescription: job.description,
      jobRequirements: job.requirements,
      resumeText: candidate.resumeText,
      config,
    });

    if (!questionResult.success) {
      console.error("[Assessment] Question generation failed", {
        candidateId,
        error: questionResult.error,
      });
      return NextResponse.json(
        { error: questionResult.error },
        { status: 500 }
      );
    }

    // 9. Persist questions in the evaluation JSONB field
    const persistedData = {
      questions: questionResult.questions.questions,
      answers: {},
      generatedAt: new Date().toISOString(),
    };

    await db
      .update(candidateRounds)
      .set({ evaluation: persistedData })
      .where(eq(candidateRounds.id, candidateRound.id));

    // 10. Return safe questions (no expectedAnswer)
    const safeQuestions = questionResult.questions.questions.map((q) => ({
      id: q.id,
      question: q.question,
      type: q.type,
      maxMarks: q.maxMarks,
      // expectedAnswer is NEVER sent to the client
    }));

    return NextResponse.json({
      success: true,
      completed: false,
      questions: safeQuestions,
      answers: {},
    });
  } catch (error) {
    console.error("[Assessment] Error loading assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
