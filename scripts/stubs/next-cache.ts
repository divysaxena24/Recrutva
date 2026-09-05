/**
 * Test-only stub for `next/cache`.
 *
 * Real application modules imported by host-side test scripts may call
 * `revalidatePath`, which requires a Next.js request context. This stub
 * no-ops so the surrounding business logic can be exercised outside Next.
 * Never used by the application itself — only via tsconfig.test.json.
 */
export function revalidatePath(): void {
  // no-op outside a Next.js runtime
}

export function revalidateTag(): void {
  // no-op outside a Next.js runtime
}

export function unstable_cache(): never {
  throw new Error("unstable_cache is not available outside Next.js");
}

export function unstable_noStore(): void {
  // no-op outside a Next.js runtime
}
