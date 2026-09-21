import { neonConfig } from "@neondatabase/serverless";

/**
 * Neon HTTP driver hardening, shared by the application (`db/index.ts`) and
 * host-side scripts that connect to Neon directly.
 *
 * Two driver defaults make the connection fragile:
 *
 *   1. `fetchEndpoint` rewrites the host from DATABASE_URL into the legacy
 *      shared endpoint (`api.<region>.neon.tech`). That endpoint can be
 *      unreachable even when the pooled host in DATABASE_URL connects fine,
 *      and it forces an extra DNS lookup. We point the driver at the host we
 *      were actually given.
 *
 *   2. Node's `fetch` (undici) enforces a 10s connect timeout and never
 *      retries, so a transient DNS/network blip surfaces as
 *      `TypeError: fetch failed` / `UND_ERR_CONNECT_TIMEOUT` instead of
 *      succeeding on a second attempt.
 *
 * This module has no server-only/Next dependencies so plain tsx scripts can
 * import it.
 */

/** Connection-level failures that are worth retrying. */
const TRANSIENT_CONNECTION_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EAI_AGAIN",
  "ENOTFOUND",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const MAX_FETCH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

/**
 * Detect connection-level failures by walking the error `cause` chain.
 * `fetch` reports DNS/connect problems as a bare `TypeError: fetch failed`
 * with the real reason hidden in `cause`, so both shapes are checked.
 */
export function isTransientConnectionError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (
      typeof candidate.code === "string" &&
      TRANSIENT_CONNECTION_CODES.has(candidate.code)
    ) {
      return true;
    }
    current = candidate.cause;
  }

  return error instanceof TypeError && error.message === "fetch failed";
}

/**
 * `fetch` with bounded retries for transient connection failures.
 * Only connection-level errors are retried: if the request never reached Neon
 * there is nothing to roll back, so replaying it is safe.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;

      if (attempt === MAX_FETCH_ATTEMPTS || !isTransientConnectionError(error)) {
        throw error;
      }

      const delayMs = RETRY_BASE_DELAY_MS * 3 ** (attempt - 1);
      console.warn(
        `[NeonFetch] Transient connection failure (attempt ${attempt}/${MAX_FETCH_ATTEMPTS}). ` +
          `Retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Apply the hardening to the global neonConfig.
 * Idempotent, so it is safe to call from several entry points.
 */
export function configureNeonHttp(): void {
  neonConfig.fetchEndpoint = (host: string) => `https://${host}/sql`;
  neonConfig.fetchFunction = fetchWithRetry;
}
