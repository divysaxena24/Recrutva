import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import "@/lib/startup"; // Side-effect: validates environment on first server access

// ─── Neon HTTP driver hardening ────────────────────────────────────────────
//
// The serverless driver talks to Neon over HTTPS (SQL-over-HTTP). Two defaults
// make that fragile in practice:
//
//   1. The driver rewrites the host from DATABASE_URL into the legacy shared
//      endpoint (`api.<region>.neon.tech`). That forces a second DNS name to
//      resolve before every query, so one flaky lookup breaks the request. We
//      point it at the host from the connection string instead — the address
//      the operator can actually verify.
//
//   2. Node's `fetch` (undici) enforces a ~10s connect timeout and never
//      retries. A transient DNS/network hiccup therefore surfaces as
//      `TypeError: fetch failed` after ~10-13s instead of succeeding on a
//      retry, which is what broke onboarding.
//
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
neonConfig.fetchFunction = fetchWithRetry;

/** Connection-level failures that are worth retrying. */
const TRANSIENT_CONNECTION_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const MAX_FETCH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

/**
 * Detect connection-level failures by walking the error `cause` chain.
 * `fetch` reports DNS/connect problems as a bare `TypeError: fetch failed`
 * with the real reason hidden in `cause`, so both shapes are checked.
 */
function isTransientConnectionError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (
      typeof candidate.code === 'string' &&
      TRANSIENT_CONNECTION_CODES.has(candidate.code)
    ) {
      return true;
    }
    current = candidate.cause;
  }

  return error instanceof TypeError && error.message === 'fetch failed';
}

/**
 * `fetch` with bounded retries for transient connection failures.
 * Only connection-level errors are retried: if the request never reached Neon
 * there is nothing to roll back, so replaying it is safe.
 */
async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
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
        `[DB] Transient connection failure (attempt ${attempt}/${MAX_FETCH_ATTEMPTS}). ` +
          `Retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Report the connection target without ever logging credentials.
 * Only the host, database name and sslmode are emitted.
 */
function logConnectionTarget(url: string): void {
  if (process.env.NODE_ENV === 'production') return;

  try {
    const { hostname, pathname, searchParams } = new URL(url);
    console.log(
      `[DB] neon-http connection target → host=${hostname} ` +
        `database=${pathname.replace(/^\//, '') || '(default)'} ` +
        `sslmode=${searchParams.get('sslmode') ?? '(driver default)'}`
    );
  } catch {
    console.warn('[DB] DATABASE_URL is not a parseable URL.');
  }
}

// Lazy database connection — only creates the connection when first accessed.
// This prevents build failures when DATABASE_URL is not available (e.g., Docker build).
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please configure it in your .env file or environment.'
      );
    }
    logConnectionTarget(url);
    const sql = neon(url);
    _db = drizzle(sql);
  }
  return _db;
}

// Proxy that defers to the lazy getter
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
