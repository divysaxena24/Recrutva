import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { applicants, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json({ error: "Invalid candidate ID" }, { status: 400 });
    }

    // Rate limit — this endpoint is reachable by unauthenticated visitors
    const blocked = await rateLimitOrReject(
      req,
      { endpoint: "candidate-view", limit: 60, windowSeconds: 600 },
      null,
    );
    if (blocked) return blocked;

    const data = await db
      .select({
        id: applicants.id,
        userId: applicants.userId,
        clerkUserId: applicants.clerkUserId,
        email: applicants.email,
        name: applicants.name,
        status: applicants.status,
        analysis: applicants.analysis,
        summary: applicants.summary,
        score: applicants.score,
        jobTitle: applicants.jobTitle,
        linkedJobTitle: jobs.title,
      })
      .from(applicants)
      .leftJoin(jobs, eq(applicants.targetJobId, jobs.id))
      .where(eq(applicants.id, candidateId))
      .limit(1);

    if (!data[0]) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const candidate = data[0];

    // Auth check: if the requester is authenticated, verify they own this candidate
    // or this is the candidate themselves.
    // If not authenticated, allow access (needed for public interview link flow).
    const { userId } = await auth();
    const { currentUser } = await import("@clerk/nextjs/server");
    const user = await currentUser();
    const candidateEmail = user?.emailAddresses?.[0]?.emailAddress;

    if (userId) {
      const isRecruiter = candidate.userId === userId;
      const isCandidate =
        candidate.clerkUserId === userId || // Primary: clerkUserId match
        (candidateEmail && candidate.email === candidateEmail); // Fallback: email match

      if (!isRecruiter && !isCandidate) {
        return NextResponse.json(
          { error: "You do not have access to this candidate" },
          { status: 403 }
        );
      }
    }

    // Strip the internal userId from the response. JSON serialization omits
    // undefined properties, so the field never reaches the client.
    const safeCandidate = { ...candidate, userId: undefined };

    return NextResponse.json({ candidate: safeCandidate });
  } catch (error) {
    console.error("Fetch Candidate Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
