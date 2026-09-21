/**
 * AI Interview question-generation regression (host-side).
 *
 * Replicates the exact Groq call made by app/api/interview/questions/route.ts
 * — same model (AI_MODELS.interview), temperature, prompt shape and JSON
 * array extraction — and validates the response contract end to end.
 *
 * Run: npx tsx --env-file=.env scripts/interview-model-regression.ts
 */
import { config } from "dotenv";
config({ path: ".env" });

import { AI_MODELS } from "../lib/ai";

const JOB_CONTEXT =
  "Role: Senior Backend Engineer. Description: Build and operate Node.js and PostgreSQL services. Requirements: 5+ years TypeScript, API design, AWS.";

const CANDIDATE_RESUME =
  "Backend engineer with 6 years of experience in Node.js, TypeScript, PostgreSQL and AWS. Led a team of 4, migrated a monolith to microservices.";

function buildPrompt(candidateName: string): string {
  // Mirrors the route's prompt template.
  return `
      You are Sarah, an AI Technical Interviewer at Recrutva.
      Your goal is to conduct a highly personalized interview.
      
      Job Context:
      ${JOB_CONTEXT}
      
      Candidate Name: ${candidateName}
      Candidate Resume Content:
      ${CANDIDATE_RESUME}
      
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
}

interface ParsedQuestion {
  question: string;
  blueprint: string;
}

async function runOnce(run: number): Promise<boolean> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY not set");
    return false;
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: buildPrompt("Regression Candidate") }],
      model: AI_MODELS.interview,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.log(`❌ run ${run}: HTTP ${res.status} — ${body.slice(0, 200)}`);
    return false;
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content || "";

  // Same extraction as the route.
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  let questionsData: ParsedQuestion[] = [];
  try {
    questionsData = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    console.log(`❌ run ${run}: extracted text is not valid JSON (${text.length} chars)`);
    return false;
  }

  const countOk = questionsData.length === 10;
  const shapeOk =
    countOk &&
    questionsData.every(
      (q) => typeof q.question === "string" && q.question.length > 0 && typeof q.blueprint === "string",
    );
  const greetsName =
    countOk && questionsData[0].question.toLowerCase().includes("regression candidate");

  console.log(
    `${countOk && shapeOk ? "✅" : "❌"} run ${run}: ${questionsData.length}/10 questions, shape ${shapeOk ? "OK" : "BAD"}, first question greets candidate: ${greetsName ? "yes" : "no"}`,
  );
  if (countOk && shapeOk) {
    console.log(`   Q1: ${questionsData[0].question.slice(0, 90)}`);
  }
  return countOk && shapeOk;
}

async function main() {
  console.log(`Model under test: ${AI_MODELS.interview}\n`);
  const runs = [1, 2, 3];
  const results: boolean[] = [];
  for (const run of runs) {
    results.push(await runOnce(run));
    if (run !== runs.length) {
      // Groq free tier: ~1000 output tokens/min — one interview generation
      // consumes most of it, so space runs out to avoid 429s.
      console.log("   (waiting 65s for rate limit window)\n");
      await new Promise((r) => setTimeout(r, 65_000));
    }
  }
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${runs.length} runs met the interview question contract`);
  process.exit(passed === runs.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
