"use server";

import { db } from "@/db";
import { applicants, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { groq, AI_MODELS } from "@/lib/ai";

export async function calculateMatchScore(candidateId: number) {
  let prompt = "";
  try {
    // 1. Fetch Candidate and Job
    const candidateData = await db.select().from(applicants).where(eq(applicants.id, candidateId)).limit(1);
    const candidate = candidateData[0];

    if (!candidate) return;

    let targetRole = candidate.jobTitle || "Software Engineer";
    let jobDescription = "Not specified";

    // If there's a linked job, get more details
    if (candidate.targetJobId) {
      const jobData = await db.select().from(jobs).where(eq(jobs.id, candidate.targetJobId)).limit(1);
      if (jobData[0]) {
        targetRole = jobData[0].title;
        jobDescription = jobData[0].description || "Not specified";
      }
    }

    // 2. Truncate inputs to avoid Groq 413 Request Entity Too Large
    const MAX_RESUME_CHARS = 12000;
    const MAX_JOB_DESC_CHARS = 5000;

    const resumeText = candidate.resumeText?.slice(0, MAX_RESUME_CHARS) || "No resume provided";
    const jobDesc = jobDescription.slice(0, MAX_JOB_DESC_CHARS);

    // 3. AI Matching Logic with Groq
    prompt = `
      You are an expert AI recruiter. Match the following candidate to the target job role.
      
      Target Role: ${targetRole}
      Job Details/Context: ${jobDesc}
      
      Candidate Name: ${candidate.name}
      Candidate Resume Content:
      ${resumeText}
      
      Requirements:
      1. Analyze the candidate's skills and experience against the target role.
      2. Return a numeric match score from 0 to 100.
      3. Return ONLY the number.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.matching,
      temperature: 0.2,
    });

    const responseText = chatCompletion.choices[0]?.message?.content || "0";
    const matchScore = parseInt(responseText.match(/\d+/)?.[0] || "0");

    // 4. Update Candidate with Score
    await db.update(applicants)
      .set({ matchScore: matchScore.toString() })
      .where(eq(applicants.id, candidateId));

    console.log(`Updated match score for ${candidate.name} for role ${targetRole}: ${matchScore}%`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI Failure:", {
      feature: "match-scoring",
      candidateId,
      model: AI_MODELS.matching,
      promptSizeBytes: prompt ? Buffer.byteLength(prompt, "utf-8") : 0,
      error: message,
    });
    // Do not rethrow — candidate creation succeeds even if AI matching fails.
  }
}
