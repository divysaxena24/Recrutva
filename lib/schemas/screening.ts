import { z } from "zod";

/**
 * Schema for a single skill analysis entry.
 */
const SkillAnalysisSchema = z.object({
  skill: z.string().describe("The skill name"),
  level: z.string().describe("Proficiency level or years of experience"),
  match: z
    .enum(["match", "partial", "missing"])
    .describe("How well the candidate matches this skill requirement"),
});

/**
 * Schema for the full AI resume screening output.
 * Strict mode ensures no extra fields leak through from the AI response.
 */
export const ScreeningResultSchema = z
  .object({
    score: z
      .number()
      .min(0)
      .max(100)
      .describe("Overall screening score from 0 to 100"),
    decision: z
      .enum(["PASS", "FAIL"])
      .describe("Screening decision based on the score and threshold"),
    summary: z
      .string()
      .min(1)
      .describe("2-3 sentence summary of the screening evaluation"),
    strengths: z
      .array(z.string())
      .min(1)
      .describe("List of candidate strengths relevant to this role"),
    missingRequirements: z
      .array(z.string())
      .describe("Critical requirements the candidate is missing"),
    skillAnalysis: z
      .array(SkillAnalysisSchema)
      .describe("Detailed skill-by-skill analysis"),
    educationMatch: z
      .string()
      .describe("Assessment of education requirements match"),
    experienceMatch: z
      .string()
      .describe("Assessment of experience requirements match"),
  })
  .strict();

export type ScreeningResult = z.infer<typeof ScreeningResultSchema>;
