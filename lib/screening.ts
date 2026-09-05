import { groq, AI_MODELS } from "@/lib/ai";
import { ScreeningResultSchema, type ScreeningResult } from "@/lib/schemas/screening";

// ─── Input types ─────────────────────────────────────────────────
export interface ScreeningInput {
  candidateId: number;
  jobTitle: string;
  jobDescription: string;
  jobRequirements: string | null;
  resumeText: string;
  passThreshold: number;
}

export interface ScreeningOutput {
  success: true;
  result: ScreeningResult;
  decision: "PASS" | "FAIL";
  score: number;
  threshold: number;
}

export interface ScreeningError {
  success: false;
  error: string;
}

// ─── Prompt construction ─────────────────────────────────────────

const MAX_RESUME_CHARS = 12000;
const MAX_JOB_DESC_CHARS = 5000;

function buildScreeningPrompt(input: ScreeningInput): string {
  const resumeText = input.resumeText.slice(0, MAX_RESUME_CHARS);
  const jobDesc = input.jobDescription.slice(0, MAX_JOB_DESC_CHARS);
  const requirements = input.jobRequirements
    ? `\n\nAdditional Requirements:\n${input.jobRequirements}`
    : "";

  return `You are an expert AI resume screener. Evaluate the following candidate against the job requirements.

## Job Title
${input.jobTitle}

## Job Description
${jobDesc}${requirements}

## Candidate Resume
${resumeText}

## Instructions
Evaluate this candidate comprehensively against the job requirements. Consider:
- Required skills match and proficiency
- Preferred skills alignment
- Education requirements
- Experience requirements (years and relevance)
- Relevant projects and work experience
- Overall resume-job relevance
- Missing critical requirements that would be deal-breakers

You MUST return ONLY a valid JSON object matching this exact schema — no markdown, no code fences, no explanation text:

{
  "score": <number 0-100 representing overall fit>,
  "decision": "<PASS or FAIL>",
  "summary": "<2-3 sentence summary of the evaluation>",
  "strengths": ["<strength1>", "<strength2>", ...],
  "missingRequirements": ["<missing1>", "<missing2>", ...],
  "skillAnalysis": [
    {
      "skill": "<skill name>",
      "level": "<proficiency or years>",
      "match": "<match|partial|missing>"
    }
  ],
  "educationMatch": "<assessment of education fit>",
  "experienceMatch": "<assessment of experience fit>"
}

Return ONLY the JSON object. Do not wrap it in code fences or add any text before or after.`;
}

// ─── Main screening function ─────────────────────────────────────

export async function runResumeScreening(
  input: ScreeningInput
): Promise<ScreeningOutput | ScreeningError> {
  const prompt = buildScreeningPrompt(input);

  try {
    // 1. Call Groq
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.screening,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content;

    if (!rawResponse) {
      console.error("[Screening] Empty response from Groq", {
        candidateId: input.candidateId,
        model: AI_MODELS.screening,
      });
      return { success: false, error: "AI returned an empty response" };
    }

    // 2. Parse JSON (handle potential markdown code fences)
    let parsed: unknown;
    try {
      // Strip markdown code fences if present
      const cleaned = rawResponse
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("[Screening] Failed to parse AI response as JSON", {
        candidateId: input.candidateId,
        rawResponse: rawResponse.slice(0, 500),
        parseError:
          parseError instanceof Error
            ? parseError.message
            : String(parseError),
      });
      return {
        success: false,
        error: "AI returned malformed JSON response",
      };
    }

    // 3. Validate with Zod
    const validationResult = ScreeningResultSchema.safeParse(parsed);

    if (!validationResult.success) {
      console.error("[Screening] Zod validation failed", {
        candidateId: input.candidateId,
        errors: validationResult.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
        parsed,
      });
      return {
        success: false,
        error: `AI response failed schema validation: ${validationResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
      };
    }

    const result = validationResult.data;

    // 4. Determine PASS/FAIL based on configured threshold
    const decision: "PASS" | "FAIL" =
      result.score >= input.passThreshold ? "PASS" : "FAIL";

    // 5. Override the AI's decision with our threshold-based decision
    //    (The AI's decision field is informational; the actual gate is the threshold)
    result.decision = decision;

    return {
      success: true,
      result,
      decision,
      score: result.score,
      threshold: input.passThreshold,
    };
  } catch (error) {
    console.error("[Screening] Groq API call failed", {
      candidateId: input.candidateId,
      model: AI_MODELS.screening,
      error: error instanceof Error ? error.message : String(error),
    });
    // Never leak AI provider internals to the client
    return {
      success: false,
      error: "AI screening failed. Please try again.",
    };
  }
}
