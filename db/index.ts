import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

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
    const sql = neon(url);
    _db = drizzle(sql);
  }
  return _db;
}

// Proxy that defers to the lazy getter
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, _receiver) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
