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
 * Shared Groq client instance (lazy).
 * Uses GROQ_API_KEY from environment variables.
 * Only created when first accessed — avoids build-time failures.
 */
let _groq: Groq | null = null;

export const groq = new Proxy({} as Groq, {
  get(_target, prop, _receiver) {
    if (!_groq) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GROQ_API_KEY environment variable is not set. " +
          "Please configure it in your .env file or environment."
        );
      }
      _groq = new Groq({ apiKey });
    }
    const value = (_groq as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(_groq);
    }
    return value;
  },
});
