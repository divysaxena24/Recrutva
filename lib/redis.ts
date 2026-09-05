import "server-only";
import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";

/**
 * Recrutva Redis Module
 *
 * Server-only Redis client supporting two transports:
 *   - Upstash REST (production/serverless): REDIS_URL=https://xxx.upstash.io + REDIS_TOKEN
 *   - Local TCP Redis (Docker development): REDIS_URL=redis://redis:6379 (no token needed)
 *
 * @upstash/redis only accepts https:// REST URLs, so local redis:// URLs are
 * handled with ioredis (TCP). Both clients are adapted behind a common
 * interface so the rest of the application is transport-agnostic.
 *
 * This module MUST NOT be imported in client components.
 *
 * Key Naming Convention:
 *   recrutva:cache:<resource>:<id>     – Caching keys
 *   recrutva:rate:<resource>:<identifier> – Rate limiting keys
 *   recrutva:session:<id>              – Temporary session data
 *   recrutva:assessment:<id>           – Assessment temporary data
 *   recrutva:test:<id>                 – Test keys (dev only)
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
// Unified client interface (subset of commands used across the codebase)
// ---------------------------------------------------------------------------

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string | number | boolean,
    opts?: { ex?: number }
  ): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  scan(
    cursor: number | string,
    opts?: { match?: string; count?: number }
  ): Promise<[number, string[]]>;
  ping(): Promise<string>;
}

// ---------------------------------------------------------------------------
// Redis client singleton
// ---------------------------------------------------------------------------

let redisInstance: RedisClient | null = null;

/**
 * Returns a singleton Redis client (or null when not configured).
 * Supports both Upstash REST (https://) and local TCP Redis (redis://).
 * Never throws — configuration or construction errors return null so the
 * rest of the application can gracefully degrade (fail-open).
 */
export function getRedis(): RedisClient | null {
  const url = process.env.REDIS_URL;

  if (!url) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Redis] REDIS_URL not configured. Redis features are disabled.",
      );
    }
    return null;
  }

  if (redisInstance) return redisInstance;

  try {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      // Upstash REST API mode (production)
      const token = process.env.REDIS_TOKEN;
      const client = new UpstashRedis({ url, token: token ?? "" });
      redisInstance = adaptUpstash(client);
    } else if (url.startsWith("redis://") || url.startsWith("rediss://")) {
      // Local Docker Redis — TCP protocol via ioredis
      const client = new IORedis(url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
        // Reconnect with capped backoff so the app recovers automatically
        // after a Redis outage. Commands issued while disconnected fail fast
        // (enableOfflineQueue=false) and callers degrade gracefully (fail-open).
        retryStrategy: (times) => Math.min(times * 500, 5000),
      });
      // The adapter starts the connection immediately and awaits it before
      // issuing commands, so the first request does not race the TCP connect.
      redisInstance = adaptIORedis(client);
    } else {
      console.error(
        `[Redis] Unsupported REDIS_URL scheme. Use https:// (Upstash) or redis:// (local).`,
      );
      return null;
    }
  } catch (err) {
    console.error("[Redis] Failed to initialize Redis client:", err);
    redisInstance = null;
    return null;
  }

  return redisInstance;
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

function adaptUpstash(client: UpstashRedis): RedisClient {
  return {
    get: (key) => client.get(key) as Promise<string | null>,
    set: (key, value, opts) =>
      opts?.ex !== undefined
        ? client.set(key, value, { ex: opts.ex })
        : client.set(key, value),
    incr: (key) => client.incr(key) as Promise<number>,
    expire: (key, seconds) => client.expire(key, seconds) as Promise<number>,
    ttl: (key) => client.ttl(key) as Promise<number>,
    del: (...keys) => client.del(...keys) as Promise<number>,
    scan: async (cursor, opts) => {
      const [next, keys] = await client.scan(Number(cursor), {
        match: opts?.match,
        count: opts?.count,
      });
      return [Number(next), keys as string[]];
    },
    ping: () => client.ping() as Promise<string>,
  };
}

function adaptIORedis(client: IORedis): RedisClient {
  // Connection failures are expected when Redis is down (fail-open design);
  // without this listener an ioredis connection error would crash the process.
  client.on("error", (err) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Redis] Local Redis connection error:",
        err instanceof Error ? err.message : String(err),
      );
    }
  });

  const scanRaw = client.scan.bind(client) as unknown as (
    cursor: string,
    ...args: Array<string | number>
  ) => Promise<[string, string[]]>;

  // ioredis does not accept boolean values — encode them as strings
  const encode = (value: string | number | boolean): string | number | Buffer =>
    typeof value === "boolean" ? (value ? "1" : "0") : value;

  const ready = client.connect().catch(() => undefined);
  const whenReady = async () => {
    await ready;
  };

  return {
    get: async (key) => {
      await whenReady();
      return client.get(key);
    },
    set: async (key, value, opts) => {
      await whenReady();
      return opts?.ex
        ? client.set(key, encode(value), "EX", opts.ex)
        : client.set(key, encode(value));
    },
    incr: async (key) => {
      await whenReady();
      return client.incr(key);
    },
    expire: async (key, seconds) => {
      await whenReady();
      return client.expire(key, seconds);
    },
    ttl: async (key) => {
      await whenReady();
      return client.ttl(key);
    },
    del: async (...keys) => {
      await whenReady();
      return client.del(...keys);
    },
    scan: async (cursor, opts) => {
      await whenReady();
      const args: Array<string | number> = [];
      if (opts?.match) {
        args.push("MATCH", opts.match);
      }
      if (opts?.count) {
        args.push("COUNT", opts.count);
      }
      const [next, keys] = await scanRaw(String(cursor), ...args);
      return [Number(next), keys];
    },
    ping: async () => {
      await whenReady();
      return client.ping();
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience wrappers (fail-safe: return null/false on error)
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

    await redis.set(key, serialized, ttlSeconds ? { ex: ttlSeconds } : undefined);
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
    const value = await redis.get(key);
    return (value as T | null) ?? null;
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
    return await redis.del(...keys);
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
    return await redis.ttl(key);
  } catch (err) {
    console.error("[Redis] TTL failed:", err);
    return -2;
  }
}

/** INCR a key (useful for rate limiting counters). Returns new value. */
export async function redisIncr(key: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    return await redis.incr(key);
  } catch (err) {
    console.error("[Redis] INCR failed:", err);
    return null;
  }
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
      message:
        result === "PONG" ? "Redis is healthy" : `Unexpected response: ${result}`,
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