import { NextResponse } from "next/server";
import { checkRedisConnection } from "@/lib/redis";

/**
 * GET /api/health
 *
 * Application health check endpoint.
 * Returns basic status information without exposing sensitive configuration.
 *
 * Response:
 * {
 *   "status": "ok" | "degraded",
 *   "timestamp": "2026-01-01T00:00:00.000Z",
 *   "services": {
 *     "redis": "ok" | "unavailable" | "error",
 *     "database": "ok" | "error"
 *   }
 * }
 */

export async function GET() {
  const timestamp = new Date().toISOString();
  const services: Record<string, string> = {};

  // Check Redis
  try {
    const redisHealth = await checkRedisConnection();
    services.redis = redisHealth.status;
  } catch {
    services.redis = "error";
  }

  // Check Database (basic connectivity test)
  try {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    services.database = "ok";
  } catch {
    services.database = "error";
  }

  // Determine overall status
  const isHealthy = services.database === "ok";
  const isDegraded = !isHealthy || services.redis !== "ok" && services.redis !== "unavailable";

  const status = isHealthy ? (isDegraded ? "degraded" : "ok") : "error";

  return NextResponse.json(
    {
      status,
      timestamp,
      services,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
