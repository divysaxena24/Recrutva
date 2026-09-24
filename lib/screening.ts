import { groq, AI_MODELS } from "@/lib/ai";
import { ScreeningResultSchema, type ScreeningResult } from "@/lib/schemas/screening";
import { calculateSkillSyncScore } from "@/lib/skillsync";

// ─── Input types ─────────────────────────────────────────────────
export interface ScreeningInput {
  candidateId: number;
  jobTitle: string;
  jobDescription: string;
  jobRequirements: string | null;
  department?: string | null;
  employmentType?: string | null;
  experience?: string | null;
  requiredSkills?: string[] | null;
  preferredSkills?: string[] | null;
  qualifications?: string[] | null;
  responsibilities?: string[] | null;
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

function buildScreeningPrompt(input: ScreeningInput, skillSyncInfo: string): string {
  const resumeText = input.resumeText.slice(0, MAX_RESUME_CHARS);
  const jobDesc = input.jobDescription.slice(0, MAX_JOB_DESC_CHARS);

  const reqSkillsStr =
    input.requiredSkills && input.requiredSkills.length > 0
      ? input.requiredSkills.join(", ")
      : "Not specified";

  const prefSkillsStr =
    input.preferredSkills && input.preferredSkills.length > 0
      ? input.preferredSkills.join(", ")
      : "None";

  const qualStr =
    input.qualifications && input.qualifications.length > 0
      ? input.qualifications.join("; ")
      : "None";

  const respStr =
    input.responsibilities && input.responsibilities.length > 0
      ? input.responsibilities.join("; ")
      : "Not specified";

  return `You are an expert AI ATS (Applicant Tracking System) resume screener. Evaluate the following candidate against the exact job requirements and produce structured analysis.

## Role Title: ${input.jobTitle}
- Department: ${input.department || "General"}
- Required Experience: ${input.experience || "Not specified"}
- Employment Type: ${input.employmentType || "Full-time"}

## SkillSync NLP Analysis Context:
${skillSyncInfo}

## Required Key Skills (PRIMARY MATCH SIGNALS)
${reqSkillsStr}

## Preferred Skills
${prefSkillsStr}

## Key Responsibilities & Expectations
${respStr}

## Desired Qualifications
${qualStr}

## Job Overview & Context
${jobDesc}
${input.jobRequirements ? `Additional Notes: ${input.jobRequirements}` : ""}

## Candidate Resume
${resumeText}

You MUST return ONLY a valid JSON object matching this exact schema — no markdown, no code fences, no explanation text:

{
  "score": <integer 0-100 representing overall fit>,
  "decision": "<PASS or FAIL>",
  "summary": "<2-3 sentence executive summary explaining the evaluation>",
  "strengths": ["<strength1>", "<strength2>", ...],
  "missingRequirements": ["<missing1>", "<missing2>", ...],
  "skillAnalysis": [
    {
      "skill": "<skill name>",
      "level": "<proficiency level or years found>",
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
  // 1. Run exact SkillSync NLP Trained Model first
  const fullJd = [
    input.jobTitle,
    input.jobDescription,
    input.jobRequirements,
    input.department,
    input.experience,
    input.requiredSkills?.join(" "),
    input.preferredSkills?.join(" "),
    input.qualifications?.join(" "),
    input.responsibilities?.join(" "),
  ].filter(Boolean).join("\n");

  const skillSyncResult = calculateSkillSyncScore(input.resumeText, fullJd);
  const skillSyncInfo = `SkillSync Score: ${skillSyncResult.finalScore}/100 (${skillSyncResult.verdict}) [Skill Match: ${skillSyncResult.skillScore}%, TF-IDF Similarity: ${skillSyncResult.tfidfScore}%]. Matched Skills: ${skillSyncResult.matchedSkills.join(", ") || "None"}. Missing Skills: ${skillSyncResult.missingSkills.join(", ") || "None"}.`;

  const prompt = buildScreeningPrompt(input, skillSyncInfo);

  try {
    // 2. Call Groq for structured qualitative evaluation
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

    // 3. Parse JSON (handle potential markdown code fences)
    let parsed: unknown;
    try {
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

    // 4. Validate with Zod
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

    // 5. Override score with exact SkillSync NLP model score
    result.score = skillSyncResult.finalScore;

    // 6. Determine PASS/FAIL based on configured threshold
    const decision: "PASS" | "FAIL" =
      result.score >= input.passThreshold ? "PASS" : "FAIL";

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
    return {
      success: false,
      error: "AI screening failed. Please try again.",
    };
  }
}

