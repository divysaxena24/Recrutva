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
import { gradeAssessment } from "@/lib/assessment";
import { parseAssessmentConfig, SubmissionSchema } from "@/lib/schemas/assessment";
import type { AssessmentQuestion } from "@/lib/schemas/assessment";

export async function POST(
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

    // 1. Parse and validate request body
    const body = await req.json();
    const submissionResult = SubmissionSchema.safeParse(body);

    if (!submissionResult.success) {
      return NextResponse.json(
        {
          error: "Invalid submission",
          details: submissionResult.error.issues.map(
            (i) => `${i.path.join(".")}: ${i.message}`
          ),
        },
        { status: 400 }
      );
    }

    const { answers } = submissionResult.data;

    // 2. Find the candidate
    const [candidate] = await db
      .select({
        id: applicants.id,
        userId: applicants.userId,
        email: applicants.email,
        targetJobId: applicants.targetJobId,
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

    // 3. Auth check
    const { userId } = await auth();
    const user = await currentUser();
    const candidateEmail = user?.emailAddresses?.[0]?.emailAddress;

    const isRecruiter = userId && candidate.userId === userId;
    const isCandidate =
      candidateEmail && candidate.email === candidateEmail;

    if (!isRecruiter && !isCandidate) {
      return NextResponse.json(
        { error: "You do not have access to submit this assessment" },
        { status: 403 }
      );
    }

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
        { error: "No pipeline found" },
        { status: 400 }
      );
    }

    const [assessmentRound] = await db
      .select({
        id: pipelineRounds.id,
        order: pipelineRounds.order,
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
        { error: "No ASSESSMENT round found" },
        { status: 400 }
      );
    }

    // 5. Find the candidate_round
    const [candidateRound] = await db
      .select({
        id: candidateRounds.id,
        status: candidateRounds.status,
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

    // 6. Duplicate prevention: block if already completed
    if (
      candidateRound.status === "PASSED" ||
      candidateRound.status === "FAILED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Assessment already completed",
          status: candidateRound.status,
          evaluation: candidateRound.evaluation,
        },
        { status: 409 }
      );
    }

    // 7. Load persisted questions from evaluation field
    const evalData = candidateRound.evaluation as Record<string, unknown> | null;
    if (
      !evalData ||
      !Array.isArray(evalData.questions) ||
      evalData.questions.length === 0
    ) {
      return NextResponse.json(
        { error: "No questions found. Please load the assessment first." },
        { status: 400 }
      );
    }

    const persistedQuestions = evalData.questions as AssessmentQuestion[];

    // 8. Validate that submitted answer IDs match persisted questions
    const validQuestionIds = new Set(persistedQuestions.map((q) => q.id));
    const invalidAnswers = answers.filter(
      (a) => !validQuestionIds.has(a.questionId)
    );

    if (invalidAnswers.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid question IDs: ${invalidAnswers.map((a) => a.questionId).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 9. Load job details
    const [job] = await db
      .select({
        title: jobs.title,
        description: jobs.description,
      })
      .from(jobs)
      .where(eq(jobs.id, candidate.targetJobId))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 400 });
    }

    // 10. Grade the assessment
    const config = parseAssessmentConfig(
      assessmentRound.configuration as Record<string, unknown> | null
    );

    const gradingResult = await gradeAssessment({
      candidateId,
      jobTitle: job.title,
      jobDescription: job.description,
      questions: persistedQuestions.map((q) => ({
        id: q.id,
        question: q.question,
        expectedAnswer: q.expectedAnswer,
        maxMarks: q.maxMarks,
      })),
      answers: answers.map((a) => ({
        questionId: a.questionId,
        answer: a.answer,
      })),
      config,
    });

    if (!gradingResult.success) {
      console.error("[Assessment] Grading failed", {
        candidateId,
        error: gradingResult.error,
      });
      // Preserve answers but don't mark as completed
      const preservedData = {
        ...evalData,
        answers: answers.reduce(
          (acc, a) => ({ ...acc, [a.questionId]: a.answer }),
          {} as Record<number, string>
        ),
        lastSubmissionAttempt: new Date().toISOString(),
        gradingError: gradingResult.error,
      };

      await db
        .update(candidateRounds)
        .set({ evaluation: preservedData })
        .where(eq(candidateRounds.id, candidateRound.id));

      return NextResponse.json(
        { error: gradingResult.error },
        { status: 500 }
      );
    }

    const grade = gradingResult.result;

    // 11. Determine PASS/FAIL based on threshold
    const roundStatus: "PASSED" | "FAILED" =
      grade.percentage >= config.passThreshold ? "PASSED" : "FAILED";

    // 12. Update the candidate_round
    const finalEvaluation = {
      questions: persistedQuestions,
      answers: answers.reduce(
        (acc, a) => ({ ...acc, [a.questionId]: a.answer }),
        {} as Record<number, string>
      ),
      grading: grade,
      completedAt: new Date().toISOString(),
    };

    await db
      .update(candidateRounds)
      .set({
        status: roundStatus,
        score: Math.round(grade.percentage),
        feedback: grade.summary,
        evaluation: finalEvaluation,
        completedAt: new Date(),
      })
      .where(eq(candidateRounds.id, candidateRound.id));

    // 13. If PASSED, activate next round
    let nextRoundActivated = false;

    if (roundStatus === "PASSED") {
      // Import the helper dynamically to avoid circular dependencies
      const { getNextPipelineRound } = await import(
        "@/app/actions/candidate-pipeline"
      );
      const nextRound = await getNextPipelineRound(
        pipeline.id,
        assessmentRound.order
      );

      if (nextRound) {
        // Deactivate any existing ACTIVE round
        const [currentActive] = await db
          .select({ id: candidateRounds.id })
          .from(candidateRounds)
          .where(
            and(
              eq(candidateRounds.candidateId, candidateId),
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

        // Activate next round
        const [existingNext] = await db
          .select({ id: candidateRounds.id })
          .from(candidateRounds)
          .where(
            and(
              eq(candidateRounds.candidateId, candidateId),
              eq(candidateRounds.roundId, nextRound.id)
            )
          )
          .limit(1);

        if (existingNext) {
          await db
            .update(candidateRounds)
            .set({
              status: "ACTIVE",
              startedAt: new Date(),
            })
            .where(eq(candidateRounds.id, existingNext.id));
        } else {
          await db.insert(candidateRounds).values({
            candidateId,
            roundId: nextRound.id,
            status: "ACTIVE",
            startedAt: new Date(),
          });
        }

        nextRoundActivated = true;
      }
    }

    return NextResponse.json({
      success: true,
      status: roundStatus,
      score: Math.round(grade.percentage),
      evaluation: grade,
      nextRoundActivated,
    });
  } catch (error) {
    console.error("[Assessment] Error submitting assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
