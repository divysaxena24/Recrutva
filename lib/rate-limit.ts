import "server-only";
import { getRedis, redisTTL, REDIS_KEYS } from "./redis";
import { NextRequest } from "next/server";

/**
 * Recrutva Rate Limiting Module
 *
 * Fixed-window rate limiter using Redis INCR + EXPIRE.
 * Reuses the singleton Redis client from lib/redis.ts.
 *
 * Key format: recrutva:rate:<endpoint>:<identifier>
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  /** Whether the request is allowed. */
  success: boolean;
  /** Maximum requests allowed in the window. */
  limit: number;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Unix timestamp (seconds) when the window resets. */
  reset: number;
}

export interface RateLimitConfig {
  /** Unique endpoint identifier (e.g. "interview-questions"). */
  endpoint: string;
  /** Maximum requests per window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

// ---------------------------------------------------------------------------
// Client identification
// ---------------------------------------------------------------------------

/**
 * Extract a rate-limit identifier from a request.
 * Priority:
 *   1. Authenticated Clerk user ID (via x-clerk-user-id header set by middleware)
 *   2. IP address from x-forwarded-for / x-real-ip
 *   3. "anonymous" fallback
 *
 * The Clerk middleware injects x-clerk-user-id into request headers on the server.
 * We read it here for rate limiting without importing Clerk directly.
 */
export function getRateLimitIdentifier(
  req: NextRequest,
  userId?: string | null,
): string {
  // Priority 1: Clerk user ID
  if (userId) {
    return `user:${userId}`;
  }

  // Priority 2: IP address
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
    // Take the first one (the original client)
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return `ip:${ip}`;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp}`;

  // Priority 3: Fallback
  return "ip:anonymous";
}

// ---------------------------------------------------------------------------
// Core rate limiting
// ---------------------------------------------------------------------------

/**
 * Check and enforce a fixed-window rate limit.
 *
 * Algorithm:
 *   1. INCR the rate-limit key
 *   2. If the counter is 1 (first request), set EXPIRE for the window
 *   3. Compare counter to limit
 *   4. Return result with remaining count and reset time
 *
 * Fail-safe: If Redis is unavailable or errors, the request is ALLOWED.
 */
export async function rateLimit(
  config: RateLimitConfig,
  identifier: string,
): Promise<RateLimitResult> {
  const { endpoint, limit, windowSeconds } = config;
  const key = REDIS_KEYS.rate(endpoint, identifier);
  const now = Math.floor(Date.now() / 1000);
  const resetTime = now + windowSeconds;

  const redis = getRedis();
  if (!redis) {
    // Redis not configured — allow request, log once per cold start
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[RateLimit] Redis not configured. Rate limiting disabled for "${endpoint}".`,
      );
    }
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: resetTime,
    };
  }

  try {
    // Atomic INCR
    const current = (await redis.incr(key)) as number;

    // First request in this window — set TTL
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    // Get remaining TTL to compute accurate reset time
    const ttl = (await redis.ttl(key)) as number;
    const actualReset =
      ttl > 0 ? now + ttl : resetTime;

    if (current > limit) {
      // Exceeded
      return {
        success: false,
        limit,
        remaining: 0,
        reset: actualReset,
      };
    }

    return {
      success: true,
      limit,
      remaining: limit - current,
      reset: actualReset,
    };
  } catch (err) {
    // Redis failure — allow the request (fail-open)
    console.error(
      `[RateLimit] Redis error for endpoint "${endpoint}":`,
      err,
    );
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: resetTime,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers for API routes
// ---------------------------------------------------------------------------

/**
 * Apply rate limiting and return a 429 Response if exceeded.
 * Returns null if the request is allowed (caller should continue).
 *
 * @example
 * ```ts
 * const blocked = await rateLimitOrReject(req, {
 *   endpoint: "interview-questions",
 *   limit: 10,
 *   windowSeconds: 600,
 * }, userId);
 * if (blocked) return blocked;
 * ```
 */
export async function rateLimitOrReject(
  req: NextRequest,
  config: RateLimitConfig,
  userId?: string | null,
): Promise<Response | null> {
  const identifier = getRateLimitIdentifier(req, userId);
  const result = await rateLimit(config, identifier);

  if (result.success) {
    return null; // Allowed — caller continues
  }

  const retryAfter = Math.max(0, result.reset - Math.floor(Date.now() / 1000));

  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    },
  );
}
