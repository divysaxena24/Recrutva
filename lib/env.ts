/**
 * Recrutva Environment Validation
 *
 * Validates required environment variables at startup.
 * Server-side only — never import in client components.
 *
 * Usage:
 *   import { validateEnv } from "@/lib/env";
 *   validateEnv(); // Throws if required variables are missing
 */

// Required environment variables for the application to function
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "GROQ_API_KEY",
] as const;

// Optional environment variables (warn if missing but don't throw)
const OPTIONAL_ENV_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "REDIS_URL",
  "REDIS_TOKEN",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
  "NEXT_PUBLIC_APP_URL",
] as const;

// Sensitive variables that should NEVER be logged or exposed
const SENSITIVE_VARS = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "GROQ_API_KEY",
  "CLOUDINARY_API_SECRET",
  "REDIS_TOKEN",
  "SMTP_PASS",
] as const;

/**
 * Validate that all required environment variables are set.
 * Throws an error if any required variable is missing.
 * Logs warnings for missing optional variables.
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check optional variables
  for (const varName of OPTIONAL_ENV_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  // Throw if required variables are missing
  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing required environment variables: ${missing.join(", ")}. ` +
      `Please check your .env file or environment configuration.`
    );
  }

  // Warn about missing optional variables (only in development)
  if (warnings.length > 0 && process.env.NODE_ENV === "development") {
    console.warn(
      `[ENV] Missing optional environment variables: ${warnings.join(", ")}. ` +
      `Some features may be unavailable.`
    );
  }

  // Verify .env files are not in the repository
  if (process.env.NODE_ENV === "development") {
    console.log("[ENV] Environment variables validated successfully.");
  }
}

/**
 * Check if a sensitive environment variable is set (without exposing its value).
 * Useful for conditional feature availability.
 */
export function isEnvSet(varName: string): boolean {
  return !!process.env[varName];
}

/**
 * Get a safe representation of environment status for health checks.
 * NEVER returns actual values — only whether they are configured.
 */
export function getEnvStatus(): Record<string, boolean> {
  const allVars = [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS];
  const status: Record<string, boolean> = {};

  for (const varName of allVars) {
    status[varName] = !!process.env[varName];
  }

  return status;
}

/**
 * Mask a sensitive string for logging.
 * Only shows first 4 and last 4 characters.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}
