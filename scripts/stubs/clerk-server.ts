/**
 * Test-only stub for `@clerk/nextjs/server`.
 *
 * Real application server actions import `auth()` from Clerk, which requires a
 * Next.js request context. Host-side regression scripts (run via tsx with
 * tsconfig.test.json) exercise those actions against the real database, so
 * this stub backs `auth()` with a mutable mock user instead.
 *
 * Scripts call `__setMockAuthUserId()` BEFORE dynamically importing a server
 * action module, simulating a signed-in recruiter. The `currentUser` stub
 * returns null (ownership checks that fall back to Clerk profile data are not
 * exercised host-side).
 *
 * Never used by the application itself — only via tsconfig.test.json.
 */

let mockAuthUserId: string | null = null;

/** Simulate a signed-in user for the current script run. */
export function __setMockAuthUserId(userId: string | null): void {
  mockAuthUserId = userId;
}

export async function auth(): Promise<{ userId: string | null }> {
  return { userId: mockAuthUserId };
}

export async function currentUser(): Promise<null> {
  return null;
}
