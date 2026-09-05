import { z } from "zod";

/**
 * Shared input validation for server actions.
 * Server actions are callable from any client, so every field must be
 * validated server-side — never trust client-provided values.
 */

// ─── Candidates ────────────────────────────────────────────────────

export const CreateCandidateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Invalid email address").max(254, "Email is too long"),
  phone: z.string().trim().min(5, "Phone number is too short").max(30, "Phone number is too long"),
  resumeText: z.string().max(20000, "Resume text is too large").optional().default(""),
  resumeUrl: z.string().url("Invalid resume URL").max(1000).optional(),
  resumeFileName: z.string().max(255).optional(),
  resumePublicId: z.string().max(500).optional(),
  jobTitle: z.string().max(255).optional(),
  targetJobId: z.number().int().positive().optional(),
  scheduledAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
    .optional(),
});

export const UpdateCandidateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120).optional(),
  email: z.string().trim().toLowerCase().email("Invalid email address").max(254).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  jobTitle: z.string().max(255).optional(),
  targetJobId: z.number().int().positive().optional(),
  scheduledAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
    .optional(),
});

// ─── Jobs ──────────────────────────────────────────────────────────

export const CreateJobSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().trim().min(1, "Description is required").max(20000, "Description is too long"),
  requirements: z.string().max(20000, "Requirements are too long").optional(),
  location: z.string().max(100).optional(),
});

// ─── Pipelines ─────────────────────────────────────────────────────

export const AddPipelineRoundSchema = z.object({
  pipelineId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  type: z
    .enum([
      "RESUME_SCREENING",
      "AI_INTERVIEW",
      "ASSESSMENT",
      "PHONE_SCREEN",
      "INTERVIEW",
      "OFFER",
      "CUSTOM",
    ])
    .or(z.string().trim().min(1).max(50)),
  configuration: z.record(z.string(), z.unknown()).optional(),
});

export const MoveCandidateToRoundSchema = z.object({
  candidateId: z.number().int().positive(),
  roundId: z.number().int().positive(),
});

export const UpdateCandidateRoundStatusSchema = z.object({
  candidateRoundId: z.number().int().positive(),
  status: z.enum(["PENDING", "ACTIVE", "PASSED", "FAILED", "SKIPPED"]),
  score: z.number().int().min(0).max(100).nullable().optional(),
  feedback: z.string().max(10000).nullable().optional(),
  evaluation: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const CompleteCandidateRoundSchema = z.object({
  candidateRoundId: z.number().int().positive(),
  status: z.enum(["PASSED", "FAILED"]),
  score: z.number().int().min(0).max(100).nullable().optional(),
  feedback: z.string().max(10000).nullable().optional(),
  evaluation: z.record(z.string(), z.unknown()).nullable().optional(),
});