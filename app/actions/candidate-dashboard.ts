"use server";

import { db } from "@/db";
import { applicants, jobs, pipelines, pipelineRounds, candidateRounds } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function getCandidateApplications() {
  const user = await currentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }

  const userEmail = user.emailAddresses[0].emailAddress;

  const data = await db
    .select({
      id: applicants.id,
      jobTitle: applicants.jobTitle,
      status: applicants.status,
      createdAt: applicants.createdAt,
      scheduledAt: applicants.scheduledAt,
      score: applicants.score,
      jobId: applicants.targetJobId,
    })
    .from(applicants)
    .where(eq(applicants.email, userEmail))
    .orderBy(desc(applicants.createdAt));

  // Apply smart status logic (same as recruiter side)
  const now = new Date();
  const enriched = await Promise.all(
    data.map(async (c) => {
      let status = c.status;
      if (status === "Completed") return { ...c, status, assessmentAvailable: false, assessmentCompleted: false, assessmentStatus: null };
      if (c.scheduledAt && new Date(c.scheduledAt) < now) status = "Missed";
      else if (c.scheduledAt && new Date(c.scheduledAt) >= now) status = "Scheduled";
      else status = "Pending";

      // Check pipeline status for assessment availability
      let assessmentAvailable = false;
      let assessmentCompleted = false;
      let assessmentStatus: string | null = null;

      if (c.jobId) {
        try {
          const [pipeline] = await db
            .select({ id: pipelines.id })
            .from(pipelines)
            .where(eq(pipelines.jobId, c.jobId))
            .limit(1);

          if (pipeline) {
            const [assessmentRound] = await db
              .select({ id: pipelineRounds.id })
              .from(pipelineRounds)
              .where(
                and(
                  eq(pipelineRounds.pipelineId, pipeline.id),
                  eq(pipelineRounds.type, "ASSESSMENT")
                )
              )
              .limit(1);

            if (assessmentRound) {
              const [candidateRound] = await db
                .select({
                  status: candidateRounds.status,
                })
                .from(candidateRounds)
                .where(
                  and(
                    eq(candidateRounds.candidateId, c.id),
                    eq(candidateRounds.roundId, assessmentRound.id)
                  )
                )
                .limit(1);

              if (candidateRound) {
                assessmentStatus = candidateRound.status;
                if (candidateRound.status === "ACTIVE") {
                  assessmentAvailable = true;
                } else if (
                  candidateRound.status === "PASSED" ||
                  candidateRound.status === "FAILED"
                ) {
                  assessmentCompleted = true;
                }
              }
            }
          }
        } catch {
          // Pipeline check failure is non-critical
        }
      }

      return { ...c, status, assessmentAvailable, assessmentCompleted, assessmentStatus };
    })
  );

  return enriched;
}
