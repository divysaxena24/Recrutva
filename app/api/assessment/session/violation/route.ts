import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { recordSecurityViolation, type ViolationType } from "@/lib/assessment-security";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // Rate limiting: 30 security events per 60 seconds per candidate
    const blocked = await rateLimitOrReject(
      req,
      { endpoint: "session-violation", limit: 30, windowSeconds: 60 },
      userId
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
      clerkUserId: userId,
      eventId,
      type: type as ViolationType,
      metadata: typeof metadata === "object" && metadata !== null ? metadata : {},
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to record violation" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error processing security violation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
