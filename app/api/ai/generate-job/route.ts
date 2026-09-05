import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { groq, AI_MODELS } from "@/lib/ai";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Require authentication — only recruiters can generate job descriptions
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { title, companyDetails } = (body ?? {}) as {
      title?: unknown;
      companyDetails?: unknown;
    };

    // Validate and bound inputs before any AI call
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: "Title is too long" }, { status: 400 });
    }
    if (companyDetails !== undefined && companyDetails !== null) {
      if (typeof companyDetails !== "string" || companyDetails.length > 3000) {
        return NextResponse.json(
          { error: "Company details must be a string of at most 3000 characters" },
          { status: 400 }
        );
      }
    }

    // Rate limit — BEFORE the expensive Groq call
    const blocked = await rateLimitOrReject(
      req,
      { endpoint: "ai-generate-job", limit: 10, windowSeconds: 600 },
      userId,
    );
    if (blocked) return blocked;

    const prompt = `
      You are an expert technical recruiter. Generate a professional and compelling job description for the role of "${title}".
      ${companyDetails ? `Context about the company/team: ${companyDetails}` : ""}
      
      The description should include:
      1. Role Overview
      2. Key Responsibilities
      3. Required Skills & Qualifications
      4. What we offer (Company culture, benefits, etc.)
      
      Format the output as a clean, structured text that can be pasted into a job portal. 
      Keep it professional, modern, and engaging. Avoid generic cliches.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.jobGeneration,
      temperature: 0.6,
    });

    const text = chatCompletion.choices[0]?.message?.content || "";

    return NextResponse.json({ description: text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI Failure:", {
      feature: "job-description-generation",
      model: AI_MODELS.jobGeneration,
      promptSizeBytes: 0, // prompt built from user input, length not tracked here
      error: message,
    });
    return NextResponse.json({ error: "Failed to generate job description" }, { status: 500 });
  }
}
