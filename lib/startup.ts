/**
 * Server-only runtime environment validation.
 *
 * `ensureEnvValidated()` must be called from lazily-executed server code paths
 * (e.g. the first database access in `db/index.ts`, or the first Groq client
 * use in `lib/ai.ts`) — NOT at module evaluation.
 *
 * Why: `next build` imports every route module during "Collecting page data".
 * Runtime-only secrets (DATABASE_URL, CLERK_SECRET_KEY, GROQ_API_KEY) are
 * intentionally unavailable in CI at build time, and the build never talks to
 * the database, Clerk, or Groq. Validating at module scope would fail every
 * production build even though the runtime configuration is correct.
 *
 * Usage:
 *   import { ensureEnvValidated } from "@/lib/startup";
 *   ensureEnvValidated(); // throws if required variables are missing
 */

import { validateEnv } from "./env";

let validated = false;

/**
 * Validate required environment variables once per process.
 *
 * Throws (on every call, until configuration is fixed) if required variables
 * are missing — no NODE_ENV-based bypass, no swallowing of the error.
 */
export function ensureEnvValidated(): void {
  if (validated) return;
  validateEnv();
  validated = true;
}
