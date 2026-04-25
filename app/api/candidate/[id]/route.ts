import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { applicants, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = (await params).id;
    const data = await db.select({
      id: applicants.id,
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
    .where(eq(applicants.id, parseInt(id)))
    .limit(1);

    if (!data[0]) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json({ candidate: data[0] });
  } catch (error) {
    console.error("Fetch Candidate Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
