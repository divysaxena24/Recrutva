/**
 * Phase 6 — Redis functional regression (host-side).
 * Run: npx tsx --tsconfig tsconfig.test.json scripts/phase6-redis-test.ts
 * Requires: local Redis reachable at REDIS_URL (default redis://localhost:6379).
 */
import { config } from "dotenv";
config({ path: ".env" });

process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

import {
  redisSet,
  redisGet,
  redisTTL,
  redisExpire,
  redisIncr,
  redisDel,
  checkRedisConnection,
  getRedis,
} from "@/lib/redis";
import {
  cacheSet,
  cacheGet,
  cacheDelete,
  cacheDeletePattern,
  withCache,
  CACHE_KEYS,
  CACHE_TTL,
} from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";

const results: { t: string; s: "PASS" | "FAIL" | "SKIP"; d: string }[] = [];
function log(t: string, ok: boolean, d: string) {
  results.push({ t, s: ok ? "PASS" : "FAIL", d });
  console.log(`${ok ? "✅" : "❌"} ${t}: ${d}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. Health / ping
  const h = await checkRedisConnection();
  log("Redis PING/health", h.status === "ok", `${h.status} (${h.latencyMs}ms)`);

  const redis = getRedis();
  if (!redis) {
    log("Redis client available", false, "client is null");
    process.exit(1);
  }

  const K = `recrutva:test:p6:${Date.now()}`;

  // 2. SET/GET (string + JSON)
  log("SET string", await redisSet(`${K}:s`, "hello", 60), "hello w/ TTL 60");
  const g = await redisGet(`${K}:s`);
  log("GET string", g === "hello", `got ${JSON.stringify(g)}`);
  log("SET object", await redisSet(`${K}:o`, { a: 1, b: "x" }, 60), "JSON object");
  const go = await redisGet<any>(`${K}:o`);
  log("GET object", go?.a === 1 && go?.b === "x", `got ${JSON.stringify(go)}`);

  // 3. TTL
  const ttl = await redisTTL(`${K}:s`);
  log("TTL present", typeof ttl === "number" && ttl > 0 && ttl <= 60, `ttl=${ttl}`);
  await redisExpire(`${K}:s`, 5);
  const ttl2 = await redisTTL(`${K}:s`);
  log("EXPIRE reduces TTL", ttl2 <= 5, `ttl after expire=5s: ${ttl2}`);

  // 4. INCR
  const i1 = await redisIncr(`${K}:ctr`);
  const i2 = await redisIncr(`${K}:ctr`);
  log("INCR increments", i1 === 1 && i2 === 2, `${i1}, ${i2}`);
  // Key auto-expires with EXPIRE
  await redisExpire(`${K}:ctr`, 10);

  // 5. DEL
  const delN = await redisDel(`${K}:s`, `${K}:o`);
  const afterDel = await redisGet(`${K}:s`);
  log("DEL removes keys", delN === 2 && afterDel === null, `deleted=${delN}`);

  // 6. Cache wrappers
  const ck = CACHE_KEYS.job(424242);
  log("cacheSet", await cacheSet(ck, { id: 424242, title: "Job" }, CACHE_TTL.job), "");
  const cg = await cacheGet<{ id: number; title: string }>(ck);
  log("cacheGet roundtrip", cg?.id === 424242 && cg?.title === "Job", JSON.stringify(cg));
  log("cacheDelete", (await cacheDelete(ck)) >= 1, "");
  log("cacheGet after delete", (await cacheGet(ck)) === null, "");

  // 7. cacheDeletePattern (SCAN + DEL)
  const p1 = `${K}:pat1`;
  const p2 = `${K}:pat2`;
  await redisSet(p1, "1", 60);
  await redisSet(p2, "2", 60);
  const patDel = await cacheDeletePattern(`${K}:pat*`);
  const p1g = await redisGet(p1);
  const p2g = await redisGet(p2);
  log("cacheDeletePattern", patDel === 2 && p1g === null && p2g === null, `deleted=${patDel}`);

  // 8. withCache
  let calls = 0;
  const wc = await withCache(`${K}:wc`, 30, async () => {
    calls++;
    return { v: calls };
  });
  const wc2 = await withCache(`${K}:wc`, 30, async () => {
    calls++;
    return { v: calls };
  });
  log("withCache caches (fetcher once)", calls === 1 && wc?.v === 1 && wc2?.v === 1, `calls=${calls}`);
  await redisDel(`${K}:wc`);

  // 9. Rate limiter counter via Redis
  const rl = await rateLimit({ endpoint: "phase6-test", limit: 3, windowSeconds: 60 }, "unit:runner");
  log("rateLimit first", rl.success && rl.remaining === 2, JSON.stringify(rl));
  await rateLimit({ endpoint: "phase6-test", limit: 3, windowSeconds: 60 }, "unit:runner");
  await rateLimit({ endpoint: "phase6-test", limit: 3, windowSeconds: 60 }, "unit:runner");
  const rl4 = await rateLimit({ endpoint: "phase6-test", limit: 3, windowSeconds: 60 }, "unit:runner");
  log("rateLimit exceeds -> blocked", !rl4.success && rl4.remaining === 0, JSON.stringify(rl4));
  // cleanup counter
  await redisDel(...(await (async () => {
    const keys: string[] = [];
    // delete rate keys via pattern
    return keys;
  })()));

  // 10. TTL expiry reset: set a 1s key, wait, confirm gone (rate-limit reset behavior)
  await redisSet(`${K}:short`, "x", 1);
  await sleep(1500);
  log("Key expires after TTL", (await redisGet(`${K}:short`)) === null, "1s TTL expired");

  // Cleanup
  await redisDel(`${K}:ctr`);

  const failed = results.filter((r) => r.s === "FAIL").length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});
