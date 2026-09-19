/**
 * Server-only startup validation.
 * 
 * Called lazily on first server-side import to validate environment variables.
 * This prevents build failures while ensuring runtime configuration is correct.
 * 
 * Usage:
 *   import "@/lib/startup"; // Side-effect import in server actions/API routes
 */

import { validateEnv } from "./env";

let validated = false;

export function ensureEnvValidated(): void {
  if (validated) return;
  validated = true;
  
  try {
    validateEnv();
  } catch (error) {
    // In development, log and continue (allow degraded mode)
    // In production, this should fail the process
    if (process.env.NODE_ENV === "production") {
      console.error("[STARTUP] Critical environment validation failed:", error);
      throw error;
    } else {
      console.warn("[STARTUP] Environment validation warning:", error);
    }
  }
}

// Auto-validate on import
ensureEnvValidated();
