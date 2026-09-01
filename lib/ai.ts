import Groq from "groq-sdk";

/**
 * Centralized AI model configuration.
 * All Groq model references should use this file to avoid hardcoding
 * model names across the codebase.
 */
export const AI_MODELS = {
  matching: "openai/gpt-oss-120b",
  screening: "llama-3.3-70b-versatile",
  assessment: "llama-3.3-70b-versatile",
  assessmentGrading: "llama-3.3-70b-versatile",
  interview: "qwen/qwen3.6-27b",
  evaluation: "openai/gpt-oss-120b",
  jobGeneration: "qwen/qwen3.6-27b",
  stt: "whisper-large-v3-turbo",
} as const;

/**
 * Shared Groq client instance.
 * Uses GROQ_API_KEY from environment variables.
 */
export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
