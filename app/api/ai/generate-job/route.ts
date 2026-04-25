import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { title, companyDetails } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

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
      model: "llama-3.1-8b-instant", 
      temperature: 0.6,
    });

    const text = chatCompletion.choices[0]?.message?.content || "";

    return NextResponse.json({ description: text });
  } catch (error) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: "Failed to generate job description" }, { status: 500 });
  }
}
