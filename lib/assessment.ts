import { groq, AI_MODELS } from "@/lib/ai";
import {
  AssessmentQuestionsSchema,
  GradingResultSchema,
  type AssessmentQuestions,
  type GradingResult,
  type AssessmentConfig,
} from "@/lib/schemas/assessment";

// ─── Input types ─────────────────────────────────────────────────

export interface QuestionGenerationInput {
  candidateId: number;
  jobTitle: string;
  jobDescription: string;
  jobRequirements: string | null;
  resumeText: string | null;
  config: AssessmentConfig;
}

export interface GradingInput {
  candidateId: number;
  jobTitle: string;
  jobDescription: string;
  questions: Array<{
    id: number;
    question: string;
    expectedAnswer: string;
    maxMarks: number;
  }>;
  answers: Array<{
    questionId: number;
    answer: string;
  }>;
  config: AssessmentConfig;
}

// ─── Question Generation ─────────────────────────────────────────

const MAX_RESUME_CHARS = 8000;
const MAX_JOB_DESC_CHARS = 5000;

function buildQuestionGenerationPrompt(input: QuestionGenerationInput): string {
  const resumeText = input.resumeText
    ? `\n\n## Candidate Resume (for context)\n${input.resumeText.slice(0, MAX_RESUME_CHARS)}`
    : "";
  const requirements = input.jobRequirements
    ? `\n\nAdditional Requirements:\n${input.jobRequirements}`
    : "";

  return `You are an expert technical assessment designer. Generate ${input.config.questionCount} high-quality assessment questions for a candidate applying to this role.

## Job Title
${input.jobTitle}

## Job Description
${input.jobDescription.slice(0, MAX_JOB_DESC_CHARS)}${requirements}${resumeText}

## Instructions
1. Generate exactly ${input.config.questionCount} questions.
2. Each question should be worth ${input.config.marksPerQuestion} marks.
3. Questions should be relevant to the actual job role and technologies.
4. Mix question types: technical, conceptual, problem-solving, and behavioral.
5. For technical roles, include questions about:
   - Data structures and algorithms
   - Programming concepts
   - System design fundamentals
   - Role-specific technologies mentioned in the job description
   - Project-based scenarios
6. For each question, provide a clear expected answer that can be used for grading.
7. Questions should have increasing difficulty.
8. Do NOT generate trivially easy questions.
9. Questions should test real understanding, not just memorization.

You MUST return ONLY a valid JSON object matching this exact schema — no markdown, no code fences, no explanation text:

{
  "questions": [
    {
      "id": 1,
      "question": "The assessment question text",
      "type": "technical|conceptual|behavioral|problem-solving",
      "expectedAnswer": "A clear expected answer for grading purposes",
      "maxMarks": ${input.config.marksPerQuestion}
    }
  ]
}

Return ONLY the JSON object. Do not wrap it in code fences or add any text before or after.`;
}

export async function generateAssessmentQuestions(
  input: QuestionGenerationInput
): Promise<{ success: true; questions: AssessmentQuestions } | { success: false; error: string }> {
  const prompt = buildQuestionGenerationPrompt(input);

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.assessment,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content;

    if (!rawResponse) {
      console.error("[Assessment] Empty response from Groq", {
        candidateId: input.candidateId,
        model: AI_MODELS.assessment,
      });
      return { success: false, error: "AI returned an empty response" };
    }

    // Parse JSON
    let parsed: unknown;
    try {
      const cleaned = rawResponse
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("[Assessment] Failed to parse AI response as JSON", {
        candidateId: input.candidateId,
        rawResponse: rawResponse.slice(0, 500),
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return { success: false, error: "AI returned malformed JSON response" };
    }

    // Validate with Zod
    const validationResult = AssessmentQuestionsSchema.safeParse(parsed);

    if (!validationResult.success) {
      console.error("[Assessment] Zod validation failed", {
        candidateId: input.candidateId,
        errors: validationResult.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return {
        success: false,
        error: `AI response failed schema validation: ${validationResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
      };
    }

    // Ensure all questions have correct maxMarks
    const questions = validationResult.data.questions.map((q) => ({
      ...q,
      maxMarks: input.config.marksPerQuestion,
    }));

    return {
      success: true,
      questions: { questions },
    };
  } catch (error) {
    console.error("[Assessment] Groq API call failed", {
      candidateId: input.candidateId,
      model: AI_MODELS.assessment,
      error: error instanceof Error ? error.message : String(error),
    });
    // Never leak AI provider internals to the client
    return {
      success: false,
      error: "AI question generation failed. Please try again.",
    };
  }
}

// ─── Grading ─────────────────────────────────────────────────────

function buildGradingPrompt(input: GradingInput): string {
  const questionsBlock = input.questions
    .map(
      (q, i) =>
        `### Question ${i + 1} (ID: ${q.id}, Max Marks: ${q.maxMarks})\n${q.question}\n\nExpected Answer: ${q.expectedAnswer}`
    )
    .join("\n\n");

  const answersBlock = input.answers
    .map(
      (a) =>
        `### Answer to Question ID ${a.questionId}:\n${a.answer || "(No answer provided)"}`
    )
    .join("\n\n");

  const maxMarksPerQ = input.config.marksPerQuestion;

  return `You are an expert technical assessor. Grade the candidate's answers against the expected answers.

## Job Title
${input.jobTitle}

## Questions and Expected Answers
${questionsBlock}

## Candidate's Answers
${answersBlock}

## Grading Instructions
1. For each question, award marks from 0 to ${maxMarksPerQ} based on accuracy, completeness, and understanding.
2. An empty or completely incorrect answer gets 0 marks.
3. A partially correct answer gets partial marks.
4. A fully correct and well-explained answer gets full marks.
5. Be fair but rigorous in grading.
6. The totalScore MUST equal the sum of all individual marks.
7. The maxScore MUST equal the sum of all maxMarks.
8. The percentage MUST be calculated as (totalScore / maxScore) * 100, rounded to 1 decimal.
9. For each question, provide brief feedback explaining the marks awarded.

You MUST return ONLY a valid JSON object matching this exact schema — no markdown, no code fences, no explanation text:

{
  "totalScore": <sum of all marks>,
  "maxScore": <sum of all maxMarks>,
  "percentage": <totalScore / maxScore * 100, rounded to 1 decimal>,
  "breakdown": [
    {
      "questionId": <question ID>,
      "question": "<question text>",
      "candidateAnswer": "<candidate's answer>",
      "marks": <marks awarded, 0 to maxMarks>,
      "maxMarks": <maximum marks for this question>,
      "feedback": "<brief feedback>"
    }
  ],
  "summary": "<2-3 sentence overall summary of the candidate's performance>"
}

Return ONLY the JSON object. Do not wrap it in code fences or add any text before or after.`;
}

export async function gradeAssessment(
  input: GradingInput
): Promise<{ success: true; result: GradingResult } | { success: false; error: string }> {
  const prompt = buildGradingPrompt(input);

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.assessmentGrading,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content;

    if (!rawResponse) {
      console.error("[Assessment Grading] Empty response from Groq", {
        candidateId: input.candidateId,
        model: AI_MODELS.assessmentGrading,
      });
      return { success: false, error: "AI returned an empty response" };
    }

    // Parse JSON
    let parsed: unknown;
    try {
      const cleaned = rawResponse
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("[Assessment Grading] Failed to parse AI response", {
        candidateId: input.candidateId,
        rawResponse: rawResponse.slice(0, 500),
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return { success: false, error: "AI returned malformed JSON response" };
    }

    // Validate with Zod
    const validationResult = GradingResultSchema.safeParse(parsed);

    if (!validationResult.success) {
      console.error("[Assessment Grading] Zod validation failed", {
        candidateId: input.candidateId,
        errors: validationResult.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return {
        success: false,
        error: `AI response failed schema validation: ${validationResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
      };
    }

    const result = validationResult.data;

    // Normalize: ensure marks don't exceed maxMarks and aren't negative
    const normalizedBreakdown = result.breakdown.map((entry) => ({
      ...entry,
      marks: Math.max(0, Math.min(entry.marks, entry.maxMarks)),
    }));

    // Recalculate totals to ensure consistency
    const normalizedTotalScore = normalizedBreakdown.reduce(
      (sum, entry) => sum + entry.marks,
      0
    );
    const normalizedMaxScore = normalizedBreakdown.reduce(
      (sum, entry) => sum + entry.maxMarks,
      0
    );
    const normalizedPercentage =
      normalizedMaxScore > 0
        ? Math.round((normalizedTotalScore / normalizedMaxScore) * 1000) / 10
        : 0;

    result.breakdown = normalizedBreakdown;
    result.totalScore = normalizedTotalScore;
    result.maxScore = normalizedMaxScore;
    result.percentage = normalizedPercentage;

    return { success: true, result };
  } catch (error) {
    console.error("[Assessment Grading] Groq API call failed", {
      candidateId: input.candidateId,
      model: AI_MODELS.assessmentGrading,
      error: error instanceof Error ? error.message : String(error),
    });
    // Never leak AI provider internals to the client
    return {
      success: false,
      error: "AI grading failed. Please try again.",
    };
  }
}
