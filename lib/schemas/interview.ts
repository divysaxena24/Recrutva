import { z } from "zod";

/**
 * Interview evaluation schema (AI-generated, persisted to applicants.analysis
 * and candidate_rounds.evaluation).
 *
 * The Groq evaluation JSON is parsed and validated here BEFORE any state is
 * mutated. Malformed AI output (wrong types, NaN/Infinity, out-of-range marks,
 * missing required fields) is rejected so invalid scores are never persisted.
 *
 * Numeric normalization rules:
 * - totalScore: rounded to an integer and clamped to 0–100 (a 101 from the AI
 *   is normalized to 100, a -5 to 0 — never persisted out of range).
 * - breakdown marks: must be within the 0–10 scale used by the interview
 *   evaluation; values outside that range are REJECTED (malformed output),
 *   valid values are rounded to an integer.
 */

// Reject non-finite values explicitly (NaN / Infinity can otherwise slip
// through z.number() depending on the runtime).
const finiteNumber = z
  .number()
  .refine((v) => Number.isFinite(v), "Score must be a finite number");

// Final total score: integer in 0..100.
const totalScoreSchema = finiteNumber.transform((v) =>
  Math.min(100, Math.max(0, Math.round(v)))
);

// Per-question mark on the 0–10 scale used by the interview evaluation.
const marksSchema = finiteNumber
  .refine((v) => v >= 0 && v <= 10, "Marks must be between 0 and 10")
  .transform((v) => Math.round(v));

export const InterviewBreakdownItemSchema = z.object({
  question: z.string().describe("The interview question text"),
  expectedAnswer: z.string().describe("Ideal answer blueprint"),
  userAnswer: z.string().describe("The candidate's transcribed answer"),
  marks: marksSchema.describe("Marks awarded (0–10 scale)"),
  feedback: z.string().describe("AI feedback for this question"),
});

export const InterviewEvaluationSchema = z.object({
  totalScore: totalScoreSchema.describe("Overall score out of 100"),
  executiveSummary: z
    .string()
    .min(1)
    .describe("2-3 sentence summary for the recruiter"),
  breakdown: z
    .array(InterviewBreakdownItemSchema)
    .describe("Question-by-question breakdown"),
});

export type InterviewEvaluation = z.infer<typeof InterviewEvaluationSchema>;
export type InterviewBreakdownItem = z.infer<typeof InterviewBreakdownItemSchema>;