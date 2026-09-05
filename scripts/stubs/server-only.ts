/**
 * Test-only stub for the `server-only` package.
 *
 * The real `server-only` package throws when imported outside a Next.js
 * server context. Host-side regression scripts import real application
 * modules (lib/cache.ts, lib/redis.ts, etc.) that do `import "server-only"`
 * as a side effect, so this stub lets tsx run them outside Next.
 *
 * Never used by the application itself — only via tsconfig.test.json.
 */
export {};
