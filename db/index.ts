import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { configureNeonHttp } from '@/lib/neon-fetch';
import "@/lib/startup"; // Side-effect: validates environment on first server access

// Harden the Neon HTTP driver before any connection is created.
// See lib/neon-fetch.ts for why (legacy `api.` endpoint rewrite + undici's
// 10s connect timeout with no retries).
configureNeonHttp();

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
