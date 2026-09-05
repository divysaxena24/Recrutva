import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { applicants } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { groq, AI_MODELS } from "@/lib/ai";
import { rateLimitOrReject } from "@/lib/rate-limit";

const MAX_TRANSCRIPT_MESSAGES = 100;
const MAX_MESSAGE_CHARS = 20000;
const MAX_TRANSCRIPT_TOTAL_CHARS = 200000;
const MAX_QUESTIONS = 25;
const MAX_QUESTION_CHARS = 5000;
const MAX_BLUEPRINT_CHARS = 5000;

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { id, transcript, questions } = (body ?? {}) as {
      id?: unknown;
      transcript?: unknown;
      questions?: unknown;
    };
    const candidateId =
      typeof id === "string" ? Number.parseInt(id, 10) : Number.NaN;

    if (!id || Number.isNaN(candidateId) || typeof transcript !== "string" && !Array.isArray(transcript)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Bound transcript input (AI cost + prompt size protection)
    if (typeof transcript === "string") {
      if (transcript.length > MAX_TRANSCRIPT_TOTAL_CHARS) {
        return NextResponse.json(
          { error: "Transcript is too large" },
          { status: 413 }
        );
      }
    } else {
      if (transcript.length > MAX_TRANSCRIPT_MESSAGES) {
        return NextResponse.json(
          { error: "Too many transcript messages" },
          { status: 413 }
        );
      }
      let total = 0;
      for (const m of transcript as Array<{ role?: unknown; content?: unknown }>) {
        if (!m || (m.role !== "ai" && m.role !== "user") || typeof m.content !== "string") {
          return NextResponse.json(
            { error: "Invalid transcript message format" },
            { status: 400 }
          );
        }
        total += m.content.length;
        if (m.content.length > MAX_MESSAGE_CHARS) {
          return NextResponse.json(
            { error: "Transcript message is too large" },
            { status: 413 }
          );
        }
      }
      if (total > MAX_TRANSCRIPT_TOTAL_CHARS) {
        return NextResponse.json(
          { error: "Transcript is too large" },
          { status: 413 }
        );
      }
    }

    // Bound the questions array (shape + size)
    if (questions !== undefined && questions !== null) {
      if (!Array.isArray(questions) || questions.length > MAX_QUESTIONS) {
        return NextResponse.json(
          { error: "Invalid questions payload" },
          { status: 400 }
        );
      }
      for (const q of questions as Array<{ question?: unknown; blueprint?: unknown }>) {
        if (!q || typeof q.question !== "string" || typeof q.blueprint !== "string") {
          return NextResponse.json(
            { error: "Invalid questions payload" },
            { status: 400 }
          );
        }
        if (q.question.length > MAX_QUESTION_CHARS || q.blueprint.length > MAX_BLUEPRINT_CHARS) {
          return NextResponse.json(
            { error: "Question payload is too large" },
            { status: 413 }
          );
        }
      }
    }

    const [existingCandidate] = await db
      .select({
        id: applicants.id,
        userId: applicants.userId,
        status: applicants.status,
        analysis: applicants.analysis,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!existingCandidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Auth check: if authenticated, verify recruiter owns this candidate.
    // If not authenticated, allow access (public interview link flow).
    const { userId } = await auth();

    if (userId && existingCandidate.userId !== userId) {
      return NextResponse.json(
        { error: "You do not have access to this candidate" },
        { status: 403 }
      );
    }

    // Rate limit — BEFORE the expensive Groq call
    const blocked = await rateLimitOrReject(
      req,
      { endpoint: "interview-complete", limit: 5, windowSeconds: 600 },
      userId,
    );
    if (blocked) return blocked;

    if (existingCandidate.status === "Completed") {
      return NextResponse.json(
        {
          success: false,
          error: "Interview already completed",
          evaluation: existingCandidate.analysis,
        },
        { status: 409 }
      );
    }

    // 1. Prepare Interview Context (bounded before prompt construction)
    const transcriptText = (Array.isArray(transcript)
      ? transcript.map((m: any) => `${m.role === 'ai' ? 'Sarah' : 'Candidate'}: ${m.content}`).join("\n")
      : transcript).slice(0, 150000);

    const questionsContext = Array.isArray(questions)
      ? questions.map((q: any, i: number) => `Q${i+1}: ${q.question}\nIdeal Answer Blueprint: ${q.blueprint}`).join("\n\n")
      : "No blueprint available.";

    // 2. Generate Evaluation with Groq
    const prompt = `
      You are an expert technical recruiter analyzing a completed interview screening.
      
      Questions Asked & Ideal Blueprints:
      ${questionsContext}
      
      Full Interview Transcript:
      ${transcriptText}
      
      Evaluation Requirements:
      1. Analyze each of the 10 questions and the candidate's corresponding response from the transcript.
      2. For each question, award marks from 0 to 10 based on how well the candidate's answer matches the 'Ideal Answer Blueprint'.
      3. Sum these marks for a total score out of 100.
      4. Provide a 2-3 sentence executive summary for the recruiter.
      
      Return ONLY a JSON object:
      {
        "totalScore": 85,
        "executiveSummary": "...",
        "breakdown": [
          {
            "question": "...",
            "expectedAnswer": "...",
            "userAnswer": "...",
            "marks": 8,
            "feedback": "..."
          }
        ]
      }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.evaluation,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const text = chatCompletion.choices[0]?.message?.content || "";
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : { totalScore: 0, executiveSummary: "Analysis failed", breakdown: [] };

    // 3. Update Candidate Status
    const updatedCandidate = await db.update(applicants)
      .set({
        status: "Completed",
        transcript: transcriptText,
        summary: evaluation.executiveSummary,
        score: evaluation.totalScore.toString(),
        matchScore: evaluation.totalScore.toString(),
        analysis: evaluation,
      })
      .where(and(eq(applicants.id, candidateId), ne(applicants.status, "Completed")))
      .returning({ id: applicants.id });

    if (updatedCandidate.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Interview already completed",
          evaluation,
        },
        { status: 409 }
      );
    }

    // 4. Update pipeline AI_INTERVIEW round (if pipeline exists)
    try {
      const { completeAIRound } = await import("@/lib/pipeline-internal");
      await completeAIRound({
        candidateId,
        score: evaluation.totalScore,
        summary: evaluation.executiveSummary,
        evaluation,
      });
    } catch (pipelineError) {
      // Pipeline update failure must not block interview completion
      console.error("Pipeline round update failed (non-critical):", pipelineError);
    }

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI Failure:", {
      feature: "interview-evaluation",
      model: AI_MODELS.evaluation,
      promptSizeBytes: 0, // prompt built from DB fields, length not tracked here
      error: message,
    });
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
