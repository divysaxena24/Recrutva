import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Recrutva Redis Module
 *
 * Server-only Redis client using Upstash Redis (HTTP-based, ideal for Vercel/serverless).
 * This module MUST NOT be imported in client components.
 *
 * Environment variables required:
 *   REDIS_URL      – Upstash Redis REST URL (production) OR redis:// URL (local)
 *   REDIS_TOKEN    – Upstash Redis REST token (production only, optional for local)
 *
 * Key Naming Convention:
 *   recrutva:cache:<resource>:<id>     – Caching keys
 *   recrutva:rate:<resource>:<identifier> – Rate limiting keys
 *   recrutva:session:<id>              – Temporary session data
 *   recrutva:assessment:<id>           – Assessment temporary data
 *   recrutva:test:<id>                 – Test keys (dev only)
 *
 * Local Development (Docker):
 *   REDIS_URL=redis://redis:6379
 *   REDIS_TOKEN is not required
 *
 * Production (Upstash):
 *   REDIS_URL=https://xxx.upstash.io
 *   REDIS_TOKEN=AXxx...
 */

// ---------------------------------------------------------------------------
// Redis key prefixes
// ---------------------------------------------------------------------------

export const REDIS_KEYS = {
  cache: (resource: string, id: string) => `recrutva:cache:${resource}:${id}`,
  rate: (resource: string, identifier: string) =>
    `recrutva:rate:${resource}:${identifier}`,
  session: (id: string) => `recrutva:session:${id}`,
  assessment: (id: string) => `recrutva:assessment:${id}`,
  test: (id: string) => `recrutva:test:${id}`,
} as const;

// ---------------------------------------------------------------------------
// Redis client singleton
// ---------------------------------------------------------------------------

let redisInstance: Redis | null = null;

/**
 * Returns a singleton Redis client.
 * Supports both Upstash (production) and local Redis (Docker development).
 *
 * If REDIS_URL is not configured, returns null
 * so the rest of the application can gracefully degrade.
 */
export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  const token = process.env.REDIS_TOKEN;

  if (!url) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Redis] REDIS_URL not configured. Redis features are disabled.",
      );
    }
    return null;
  }

  if (!redisInstance) {
    // Upstash Redis SDK supports both REST API (with token) and standard Redis protocol (without token)
    // For local Docker Redis: REDIS_URL=redis://redis:6379 (no token needed)
    // For production Upstash: REDIS_URL=https://xxx.upstash.io + REDIS_TOKEN
    if (token) {
      // Upstash REST API mode (production)
      redisInstance = new Redis({ url, token });
    } else {
      // Standard Redis protocol mode (local Docker)
      // Use a dummy token since @upstash/redis requires it
      redisInstance = new Redis({ url, token: "dummy-token-for-local-redis" });
    }
  }

  return redisInstance;
}

// ---------------------------------------------------------------------------
// Convenience wrappers (fail-safe: return null on error)
// ---------------------------------------------------------------------------

/** SET with optional TTL in seconds. */
export async function redisSet(
  key: string,
  value: string | number | object,
  ttlSeconds?: number,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const serialized =
      typeof value === "string" || typeof value === "number"
        ? value
        : JSON.stringify(value);

    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(key, serialized, { ex: ttlSeconds });
    } else {
      await redis.set(key, serialized);
    }
    return true;
  } catch (err) {
    console.error("[Redis] SET failed:", err);
    return false;
  }
}

/** GET a value. Returns null if key does not exist or on error. */
export async function redisGet<T = string>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch (err) {
    console.error("[Redis] GET failed:", err);
    return null;
  }
}

/** DELETE one or more keys. Returns number of keys removed. */
export async function redisDel(...keys: string[]): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  try {
    if (keys.length === 0) return 0;
    if (keys.length === 1) {
      return (await redis.del(keys[0])) as number;
    }
    return (await redis.del(...keys)) as number;
  } catch (err) {
    console.error("[Redis] DEL failed:", err);
    return 0;
  }
}

/** Set TTL (expire) on an existing key. Returns true on success. */
export async function redisExpire(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const result = await redis.expire(key, ttlSeconds);
    return result === 1;
  } catch (err) {
    console.error("[Redis] EXPIRE failed:", err);
    return false;
  }
}

/** Get remaining TTL for a key in seconds. -1 = no expiry, -2 = key missing. */
export async function redisTTL(key: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return -2;

  try {
    return (await redis.ttl(key)) as number;
  } catch (err) {
    console.error("[Redis] TTL failed:", err);
    return -2;
  }
}

/** INCR a key (useful for rate limiting counters). Returns new value. */
export async function redisIncr(key: string): Promise<number | null> {
  const redis = getRedis();
  if (redis) {
    try {
      return (await redis.incr(key)) as number;
    } catch (err) {
      console.error("[Redis] INCR failed:", err);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export interface RedisHealthResult {
  status: "ok" | "unavailable" | "error";
  latencyMs: number | null;
  message: string;
  configured: boolean;
}

/**
 * Pings Redis and returns a health report.
 * Never throws — always returns a result object.
 */
export async function checkRedisConnection(): Promise<RedisHealthResult> {
  const url = process.env.REDIS_URL;

  if (!url) {
    return {
      status: "unavailable",
      latencyMs: null,
      message: "REDIS_URL not configured",
      configured: false,
    };
  }

  const redis = getRedis();
  if (!redis) {
    return {
      status: "unavailable",
      latencyMs: null,
      message: "Redis client could not be created",
      configured: true,
    };
  }

  const start = performance.now();
  try {
    const result = await redis.ping();
    const latencyMs = Math.round(performance.now() - start);

    return {
      status: result === "PONG" ? "ok" : "error",
      latencyMs,
      message: result === "PONG" ? "Redis is healthy" : `Unexpected response: ${result}`,
      configured: true,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message =
      err instanceof Error ? err.message : "Unknown error during Redis ping";

    console.error("[Redis] Health check failed:", err);

    return {
      status: "error",
      latencyMs,
      message,
      configured: true,
    };
  }
}
