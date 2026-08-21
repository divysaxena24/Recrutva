import { db } from "@/db";
import { applicants, jobs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { groq, AI_MODELS } from "@/lib/ai";

export async function GET(req: NextRequest) {
  try {
    const candidateId = req.nextUrl.searchParams.get("candidateId");
    if (!candidateId) return NextResponse.json({ error: "Missing candidateId" }, { status: 400 });

    const parsedId = parseInt(candidateId);
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: "Invalid candidateId" }, { status: 400 });
    }

    // 1. Fetch Candidate
    const candidateData = await db
      .select({
        id: applicants.id,
        userId: applicants.userId,
        name: applicants.name,
        email: applicants.email,
        phone: applicants.phone,
        status: applicants.status,
        resumeText: applicants.resumeText,
        jobTitle: applicants.jobTitle,
        targetJobId: applicants.targetJobId,
      })
      .from(applicants)
      .where(eq(applicants.id, parsedId))
      .limit(1);
    const candidate = candidateData[0];

    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    // Auth check: if authenticated, verify recruiter owns this candidate.
    // If not authenticated, allow access (public interview link flow).
    const { userId } = await auth();

    if (userId && candidate.userId !== userId) {
      return NextResponse.json(
        { error: "You do not have access to this candidate" },
        { status: 403 }
      );
    }

    // Prevent generating questions for already-completed interviews
    if (candidate.status === "Completed") {
      return NextResponse.json(
        { error: "Interview already completed" },
        { status: 409 }
      );
    }

    // 2. Build job context
    let jobContext = `Role: ${candidate.jobTitle || "Software Engineer"}`;
    if (candidate.targetJobId) {
      const jobData = await db.select().from(jobs).where(eq(jobs.id, candidate.targetJobId)).limit(1);
      if (jobData[0]) {
        jobContext = `Role: ${jobData[0].title}. Description: ${jobData[0].description}. Requirements: ${jobData[0].requirements}`;
      }
    }

    // 3. Generate Questions with Groq
    const prompt = `
      You are Sarah, an AI Technical Interviewer at Recrutva.
      Your goal is to conduct a highly personalized interview.
      
      Job Context:
      ${jobContext}
      
      Candidate Name: ${candidate.name}
      Candidate Resume Content:
      ${candidate.resumeText || "No resume provided"}
      
      Requirements for Questions:
      1. Generate EXACTLY 10 questions.
      2. The questions must be purely based on the technical and behavioral requirements of the target Job Role. Do NOT base the core technical questions on the candidate's resume.
      3. First question: Professional introduction greeting the candidate by name.
      4. Technical questions: Ask challenging, role-specific technical questions to assess their competence for this specific job.
      5. Behavioral questions: Ask about scenarios they would face in this role.
      6. For each question, provide a 'blueprint' which is a brief summary of what a high-quality (10/10) answer should include.
      
      Return ONLY a JSON array of objects with 'question' and 'blueprint' keys:
      [
        {"question": "...", "blueprint": "..."},
        ... 10 items ...
      ]
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.interview,
      temperature: 0.7,
    });
    
    const text = chatCompletion.choices[0]?.message?.content || "";
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const questionsData = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json(questionsData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI Failure:", {
      feature: "interview-questions",
      model: AI_MODELS.interview,
      promptSizeBytes: 0, // prompt built from DB fields, length not tracked here
      error: message,
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
