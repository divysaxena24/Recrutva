import { NextResponse } from "next/server";
import {
  checkRedisConnection,
  getRedis,
  redisSet,
  redisGet,
  redisDel,
  redisTTL,
  redisExpire,
  REDIS_KEYS,
} from "@/lib/redis";

/**
 * GET /api/test-redis
 *
 * Development-only Redis test endpoint.
 * Tests: PING, SET, GET, TTL/EXPIRE, DELETE.
 * Cleans up all test keys afterward.
 *
 * BLOCKED in production — returns 404.
 */

interface TestStep {
  name: string;
  status: "pass" | "fail" | "skip";
  detail?: string;
}

export async function GET() {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const steps: TestStep[] = [];
  const testKey = REDIS_KEYS.test(`healthcheck-${Date.now()}`);

  // ── Step 1: Health check (PING) ───────────────────────────────────────
  const health = await checkRedisConnection();
  if (health.status !== "ok") {
    return NextResponse.json(
      {
        status: "unavailable",
        message: health.message,
        configured: health.configured,
        steps: [],
      },
      { status: health.configured ? 503 : 200 },
    );
  }

  steps.push({
    name: "PING",
    status: "pass",
    detail: `Pong (${health.latencyMs}ms)`,
  });

  // ── Step 2: SET ───────────────────────────────────────────────────────
  const setValue = "recrutva-test-value";
  const setResult = await redisSet(testKey, setValue, 30);
  steps.push({
    name: "SET",
    status: setResult ? "pass" : "fail",
    detail: setResult
      ? `Set "${testKey}" = "${setValue}" with TTL 30s`
      : "Failed to set key",
  });

  if (!setResult) {
    // If SET fails, no point continuing
    return NextResponse.json({
      status: "partial",
      message: "SET failed; remaining tests skipped",
      steps,
    });
  }

  // ── Step 3: GET ───────────────────────────────────────────────────────
  const getValue = await redisGet<string>(testKey);
  steps.push({
    name: "GET",
    status: getValue === setValue ? "pass" : "fail",
    detail: `Got "${getValue}"`,
  });

  // ── Step 4: TTL / EXPIRE ──────────────────────────────────────────────
  const ttlBefore = await redisTTL(testKey);
  steps.push({
    name: "TTL",
    status: ttlBefore > 0 ? "pass" : "fail",
    detail: `TTL = ${ttlBefore}s`,
  });

  // Reduce TTL to 5 seconds
  const expireResult = await redisExpire(testKey, 5);
  const ttlAfter = await redisTTL(testKey);
  steps.push({
    name: "EXPIRE",
    status: expireResult && ttlAfter <= 5 ? "pass" : "fail",
    detail: `Set EXPIRE 5s → new TTL = ${ttlAfter}s`,
  });

  // ── Step 5: DELETE ────────────────────────────────────────────────────
  const delCount = await redisDel(testKey);
  const getDeleted = await redisGet(testKey);
  steps.push({
    name: "DELETE",
    status: delCount >= 1 && getDeleted === null ? "pass" : "fail",
    detail: `Deleted ${delCount} key(s). GET after DELETE: ${getDeleted === null ? "null" : getDeleted}`,
  });

  // ── Summary ───────────────────────────────────────────────────────────
  const failed = steps.filter((s) => s.status === "fail").length;
  const allPassed = failed === 0;

  return NextResponse.json({
    status: allPassed ? "ok" : "partial",
    message: allPassed
      ? "All Redis tests passed"
      : `${failed} test(s) failed`,
    latencyMs: health.latencyMs,
    steps,
  });
}
