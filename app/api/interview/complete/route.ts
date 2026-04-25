import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { applicants } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { id, transcript, questions } = await req.json();
    const candidateId = Number.parseInt(id, 10);

    if (!id || Number.isNaN(candidateId) || !transcript) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [existingCandidate] = await db
      .select({
        id: applicants.id,
        status: applicants.status,
        analysis: applicants.analysis,
      })
      .from(applicants)
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!existingCandidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

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

    // 1. Prepare Interview Context
    const transcriptText = Array.isArray(transcript) 
      ? transcript.map((m: any) => `${m.role === 'ai' ? 'Sarah' : 'Candidate'}: ${m.content}`).join("\n")
      : transcript;

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
      model: "llama-3.3-70b-versatile", // Using 70b model for better reasoning in evaluation
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
        analysis: evaluation, // Save the full breakdown to the DB
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

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    console.error("Evaluation Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
