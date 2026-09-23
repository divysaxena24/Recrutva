import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ─── Public Routes (no auth required) ──────────────────────────────
const isPublicRoute = createRouteMatcher([
  "/",
  "/jobs",
  "/jobs/(.*)",
  "/api/upload/resume",       // Public: anonymous job applications
  "/api/cron/(.*)",           // Cron has its own secret-based auth
  "/api/health",              // Health check — no secrets exposed
  "/api/tts/(.*)",            // TTS streaming for interview
  "/api/interview/transcribe", // Whisper STT (called during interview)
  "/onboarding",              // Post-signup role selection
  "/api/webhook(.*)",         // Clerk webhooks if any
]);

// ─── Recruiter-only Routes ─────────────────────────────────────────
const isRecruiterRoute = createRouteMatcher([
  "/dashboard",
  "/dashboard/(.*)",
]);

// ─── Candidate-only Routes ─────────────────────────────────────────
const isCandidateRoute = createRouteMatcher([
  "/candidate-dashboard",
  "/candidate-dashboard/(.*)",
]);

// ─── Authenticated-only Routes (either role) ───────────────────────
const isAuthenticatedRoute = createRouteMatcher([
  "/assessment/(.*)",
  "/interview/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), interest-cohort=()"
  );

  // HSTS for production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  // ─── Route Protection ──────────────────────────────────────────

  // Public routes — no auth required
  if (isPublicRoute(req)) {
    return response;
  }

  // Protected routes require authentication
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    // Unauthenticated API request -> return HTTP 401 Unauthorized JSON
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized access. Please sign in." },
        { status: 401 }
      );
    }
    // Unauthenticated page request -> redirect directly to Sign In page
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Recruiter routes — require authentication (role checked server-side in actions)
  if (isRecruiterRoute(req)) {
    return response;
  }

  // Candidate routes — require authentication (role checked server-side in actions)
  if (isCandidateRoute(req)) {
    return response;
  }

  // Authenticated routes (assessment, interview, etc.)
  if (isAuthenticatedRoute(req)) {
    return response;
  }

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
