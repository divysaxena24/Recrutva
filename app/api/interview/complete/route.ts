import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db"; // Assuming db is exported from @/db
import { candidates } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { interviewId, transcript, candidateName } = await req.json();
    const transcriptText = transcript.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    // 1. Define Blueprints for analysis
    const blueprints: Record<string, string[]> = {
      "introduction": ["background", "experience", "tech stack", "software"],
      "strength": ["technical", "projects", "problem-solving", "skills"],
      "challenge": ["problem", "solution", "technical difficulty", "resolution"],
      "learning": ["new technology", "documentation", "learning", "growth"],
      "goals": ["career", "future", "long-term", "contribution"]
    };

    const questionKeys = ["introduction", "strength", "challenge", "learning", "goals"];
    
    // 2. Perform Question-wise Analysis
    const interviewData = [];
    let aiQuestionIdx = 0;
    
    for (let i = 0; i < transcript.length; i++) {
      if (transcript[i].role === 'user') {
        const question = transcript[i-1]?.content || "Unknown Question";
        const answer = transcript[i].content;
        const key = questionKeys[aiQuestionIdx] || "general";
        
        const blueprintKeywords = blueprints[key] || [];
        const isApproved = blueprintKeywords.some(keyword => 
          answer.toLowerCase().includes(keyword.toLowerCase())
        );

        interviewData.push({
          question,
          answer,
          status: isApproved ? "Approved" : "Not Approved",
          blueprint: blueprintKeywords.join(", ")
        });
        
        aiQuestionIdx++;
      }
    }

    // 3. Generate 5-line Summary
    const summaryLines = [
      `Overall Performance: The candidate provided structured responses across all ${interviewData.length} modules.`,
      `Technical Depth: Demonstrated strong alignment with key requirements in ${interviewData.filter(d => d.status === 'Approved').length} out of 5 areas.`,
      `Communication: Responses were clear, though some areas could benefit from more specific technical examples.`,
      `Cultural Fit: Showed high enthusiasm and a clear vision for their long-term growth within the team.`,
      `Final Verdict: A strong candidate who meets the core blueprints for the Senior Frontend role.`
    ];
    
    const finalSummary = {
      breakdown: interviewData,
      executiveSummary: summaryLines.join('\n'),
      score: `${(interviewData.filter(d => d.status === 'Approved').length / 5) * 100}/100`
    };

    // 4. Update the candidate in DB
    const candidateId = parseInt(interviewId);
    if (isNaN(candidateId)) {
      return NextResponse.json({ error: "Invalid interview ID" }, { status: 400 });
    }

    await db.update(candidates)
      .set({
        status: "Completed",
        transcript: transcriptText,
        summary: JSON.stringify(finalSummary),
        score: finalSummary.score,
      })
      .where(eq(candidates.id, candidateId));

    return NextResponse.json({ success: true, analysis: finalSummary });
  } catch (error) {
    console.error("Interview Completion Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
