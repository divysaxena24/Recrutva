import { z } from "zod";

// ─── Question Schema (AI-generated, persisted) ──────────────────

export const AssessmentQuestionSchema = z.object({
  id: z.number().min(1).describe("Unique question ID starting from 1"),
  question: z.string().min(1).describe("The assessment question text"),
  type: z
    .enum(["technical", "conceptual", "behavioral", "problem-solving"])
    .describe("Category of the question"),
  expectedAnswer: z
    .string()
    .min(1)
    .describe("Ideal answer for grading (never exposed to candidates)"),
  maxMarks: z.number().min(1).max(100).describe("Maximum marks for this question"),
});

export const AssessmentQuestionsSchema = z
  .object({
    questions: z
      .array(AssessmentQuestionSchema)
      .min(1)
      .max(50)
      .describe("List of assessment questions"),
  })
  .strict();

export type AssessmentQuestion = z.infer<typeof AssessmentQuestionSchema>;
export type AssessmentQuestions = z.infer<typeof AssessmentQuestionsSchema>;

// ─── Candidate Answer Schema (submitted by candidate) ───────────

export const CandidateAnswerSchema = z.object({
  questionId: z.number().min(1).describe("ID of the question being answered"),
  answer: z.string().describe("Candidate's answer text (can be empty)"),
});

export const SubmissionSchema = z
  .object({
    answers: z
      .array(CandidateAnswerSchema)
      .min(1)
      .describe("Candidate's answers to all questions"),
  })
  .strict();

export type CandidateAnswer = z.infer<typeof CandidateAnswerSchema>;
export type Submission = z.infer<typeof SubmissionSchema>;

// ─── Grading Output Schema (AI-graded result) ───────────────────

const GradingBreakdownEntrySchema = z.object({
  questionId: z.number().describe("ID of the question"),
  question: z.string().describe("Original question text"),
  candidateAnswer: z.string().describe("Candidate's answer"),
  marks: z.number().min(0).describe("Marks awarded (clamped to 0..maxMarks)"),
  maxMarks: z.number().min(1).describe("Maximum possible marks"),
  feedback: z.string().describe("AI feedback on this answer"),
});

export const GradingResultSchema = z
  .object({
    totalScore: z.number().min(0).describe("Sum of individual marks"),
    maxScore: z.number().min(1).describe("Sum of all maxMarks"),
    percentage: z.number().min(0).max(100).describe("Percentage score"),
    breakdown: z
      .array(GradingBreakdownEntrySchema)
      .min(1)
      .describe("Question-by-question grading"),
    summary: z.string().min(1).describe("Overall grading summary"),
  })
  .strict();

export type GradingResult = z.infer<typeof GradingResultSchema>;
export type GradingBreakdownEntry = z.infer<typeof GradingBreakdownEntrySchema>;

// ─── Configuration Schema ───────────────────────────────────────

export const AssessmentConfigSchema = z.object({
  questionCount: z.number().min(1).max(50).default(10),
  passThreshold: z.number().min(0).max(100).default(50),
  marksPerQuestion: z.number().min(1).max(100).default(10),
});

export type AssessmentConfig = z.infer<typeof AssessmentConfigSchema>;

export function parseAssessmentConfig(
  raw: Record<string, unknown> | null | undefined
): AssessmentConfig {
  const result = AssessmentConfigSchema.safeParse(raw ?? {});
  if (result.success) return result.data;
  // Fallback to defaults on validation failure
  return { questionCount: 10, passThreshold: 50, marksPerQuestion: 10 };
}
