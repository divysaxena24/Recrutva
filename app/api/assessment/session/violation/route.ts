import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { recordSecurityViolation, type ViolationType } from "@/lib/assessment-security";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const effectiveUserId = userId || "anonymous_candidate_session";

    // Rate limiting: 30 security events per 60 seconds per candidate
    const blocked = await rateLimitOrReject(
      req,
      { endpoint: "session-violation", limit: 30, windowSeconds: 60 },
      effectiveUserId
    );

    if (blocked) return blocked;

    const body = await req.json();
    const { candidateRoundId, eventId, type, metadata } = body;

    if (!candidateRoundId || typeof candidateRoundId !== "number") {
      return NextResponse.json({ error: "Invalid candidateRoundId" }, { status: 400 });
    }

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
    }

    const VALID_TYPES: ViolationType[] = [
      "FULLSCREEN_EXIT",
      "TAB_SWITCH",
      "PAGE_HIDDEN",
      "WINDOW_BLUR",
      "ATTEMPT_RELOAD",
      "SESSION_TIMEOUT",
    ];

    if (!type || !VALID_TYPES.includes(type as ViolationType)) {
      return NextResponse.json({ error: "Invalid violation type" }, { status: 400 });
    }

    const result = await recordSecurityViolation({
      candidateRoundId,
      clerkUserId: effectiveUserId,
      eventId,
      type: type as ViolationType,
      metadata: typeof metadata === "object" && metadata !== null ? metadata : {},
    });

    if (!result.success) {
      // Return 200 with local violation acknowledgement so candidate shell state is maintained
      return NextResponse.json({
        success: true,
        violationCount: 1,
        maxViolations: 3,
        terminated: false,
        warning: result.error,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error processing security violation:", error);
    // Return graceful fallback so local proctoring UI in shell remains functional
    return NextResponse.json({
      success: true,
      violationCount: 1,
      maxViolations: 3,
      terminated: false,
    });
  }
}
