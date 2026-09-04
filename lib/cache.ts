import "server-only";
import { getRedis, redisGet, redisSet, redisDel, REDIS_KEYS } from "./redis";

/**
 * Recrutva Caching Module
 *
 * Server-only Redis caching layer built on top of lib/redis.ts.
 * Provides typed get/set/delete with JSON serialization, TTL management,
 * and helper key builders.
 *
 * Key format: recrutva:cache:<resource>:<id>
 *
 * IMPORTANT: This is server-side application caching ONLY.
 * Do NOT use for authorization. Always authenticate/authorize BEFORE cache lookup.
 */

// ---------------------------------------------------------------------------
// Cache TTL Constants (seconds)
// ---------------------------------------------------------------------------

export const CACHE_TTL = {
  /** AI-generated interview questions — personalized per candidate+job. */
  interviewQuestions: 15 * 60, // 15 minutes
  /** Job metadata — relatively static, changes infrequently. */
  job: 10 * 60, // 10 minutes
  /** Job list (all open jobs for recruiter). */
  jobList: 5 * 60, // 5 minutes
  /** All open jobs (public). */
  allJobs: 5 * 60, // 5 minutes
  /** Assessment questions — persisted in DB too, but cache for fast repeat reads. */
  assessment: 15 * 60, // 15 minutes
  /** General short-lived cache. */
  short: 2 * 60, // 2 minutes
  /** General medium-lived cache. */
  medium: 5 * 60, // 5 minutes
} as const;

// ---------------------------------------------------------------------------
// Cache Key Builders
// ---------------------------------------------------------------------------

export const CACHE_KEYS = {
  /** Interview questions: personalized per candidate+job combination. */
  interviewQuestions: (candidateId: number, jobId: number | null) =>
    REDIS_KEYS.cache("interview-questions", `${jobId ?? "no-job"}:${candidateId}`),

  /** Job metadata by ID. */
  job: (jobId: number) => REDIS_KEYS.cache("job", String(jobId)),

  /** Recruiter's job list. */
  jobList: (userId: string) => REDIS_KEYS.cache("job-list", userId),

  /** All open jobs (public listing). */
  allJobs: () => REDIS_KEYS.cache("all-jobs", "open"),

  /** Assessment questions for a candidate. */
  assessment: (candidateId: number) =>
    REDIS_KEYS.cache("assessment", String(candidateId)),
} as const;

// ---------------------------------------------------------------------------
// Core cache functions
// ---------------------------------------------------------------------------

/**
 * Get a cached value by key. Returns null on miss, error, or missing key.
 * Safely handles malformed JSON — treats corrupt entries as misses.
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    if (raw === null || raw === undefined) {
      return null;
    }

    // Upstash auto-deserializes JSON. If it's a string that looks like JSON, parse it.
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as T;
        return parsed;
      } catch {
        // Not JSON — return as-is if it's a simple string
        return raw as T;
      }
    }

    // Already deserialized by Upstash (numbers, booleans, arrays, objects)
    return raw as T;
  } catch (err) {
    console.error("[Cache] GET failed:", err);
    return null;
  }
}

/**
 * Store a value in cache with a TTL.
 * Objects/arrays are JSON-serialized. Primitives stored as-is.
 */
export async function cacheSet<T = unknown>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const serialized =
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? value
        : JSON.stringify(value);

    await redis.set(key, serialized, { ex: ttlSeconds });
    return true;
  } catch (err) {
    console.error("[Cache] SET failed:", err);
    return false;
  }
}

/**
 * Delete one or more cache keys. Returns number of keys removed.
 */
export async function cacheDelete(...keys: string[]): Promise<number> {
  return redisDel(...keys);
}

/**
 * Cached function helper — wraps an async function with cache-through logic.
 *
 * @example
 * ```ts
 * const questions = await withCache(
 *   CACHE_KEYS.interviewQuestions(candidateId, jobId),
 *   CACHE_TTL.interviewQuestions,
 *   () => generateQuestionsViaGroq(candidateId, jobId),
 * );
 * ```
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss — execute the expensive operation
  const result = await fetcher();

  // Store result (fire-and-forget — don't fail the request if cache write fails)
  if (result !== null && result !== undefined) {
    await cacheSet(key, result, ttlSeconds);
  }

  return result;
}

/**
 * Invalidate cache entries by pattern (prefix scan).
 * Uses Redis SCAN instead of KEYS for production safety.
 * Returns the number of keys deleted.
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  try {
    let cursor = 0;
    let totalDeleted = 0;
    const batchSize = 100;

    do {
      const result = await redis.scan(cursor, {
        match: pattern,
        count: batchSize,
      });

      cursor = Number(result[0]);
      const keys = result[1] as string[];

      if (keys.length > 0) {
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await redisDel(...batch);
          totalDeleted += batch.length;
        }
      }
    } while (cursor !== 0);

    return totalDeleted;
  } catch (err) {
    console.error("[Cache] DELETE pattern failed:", err);
    return 0;
  }
}
