"use server";

import Groq from "groq-sdk";
import { db } from "@/db";
import { applicants, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function calculateMatchScore(candidateId: number) {
  try {
    // 1. Fetch Candidate and Job
    const candidateData = await db.select().from(applicants).where(eq(applicants.id, candidateId)).limit(1);
    const candidate = candidateData[0];
    
    if (!candidate) return;

    let targetRole = candidate.jobTitle || "Software Engineer";
    let jobDetails = "Not specified";

    // If there's a linked job, get more details
    if (candidate.targetJobId) {
      const jobData = await db.select().from(jobs).where(eq(jobs.id, candidate.targetJobId)).limit(1);
      if (jobData[0]) {
        targetRole = jobData[0].title;
        jobDetails = `${jobData[0].description}\nRequirements: ${jobData[0].requirements}`;
      }
    }

    // 2. AI Matching Logic with Groq
    const prompt = `
      You are an expert AI recruiter. Match the following candidate to the target job role.
      
      Target Role: ${targetRole}
      Job Details/Context: ${jobDetails}
      
      Candidate Name: ${candidate.name}
      Candidate Resume Content:
      ${candidate.resumeText || "No resume provided"}
      
      Requirements:
      1. Analyze the candidate's skills and experience against the target role.
      2. Return a numeric match score from 0 to 100.
      3. Return ONLY the number.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant", 
      temperature: 0.2,
    });

    const responseText = chatCompletion.choices[0]?.message?.content || "0";
    const matchScore = parseInt(responseText.match(/\d+/)?.[0] || "0");

    // 3. Update Candidate with Score
    await db.update(applicants)
      .set({ matchScore: matchScore.toString() })
      .where(eq(applicants.id, candidateId));

    console.log(`Updated match score for ${candidate.name} for role ${targetRole}: ${matchScore}%`);
  } catch (error) {
    console.error("AI Matching Error:", error);
  }
}
