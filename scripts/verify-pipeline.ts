/**
 * Verify script: Check pipeline and rounds in database.
 *
 * Usage: npx tsx scripts/verify-pipeline.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { jobs, pipelines, pipelineRounds, candidateRounds } from "../db/schema";
import { eq, asc } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log("─".repeat(60));
  console.log("  Recrutva — Pipeline Verification");
  console.log("─".repeat(60));

  // Verify all tables exist and have data
  console.log("\n[1] All jobs:");
  const allJobs = await db.select().from(jobs).orderBy(jobs.createdAt);
  for (const job of allJobs) {
    console.log(`  id=${job.id} "${job.title}" (userId=${job.userId})`);
  }

  console.log("\n[2] All pipelines:");
  const allPipelines = await db.select().from(pipelines);
  for (const p of allPipelines) {
    console.log(`  id=${p.id} "${p.name}" (jobId=${p.jobId})`);
  }

  console.log("\n[3] All pipeline_rounds (ordered):");
  const allRounds = await db.select().from(pipelineRounds).orderBy(asc(pipelineRounds.order));
  for (const r of allRounds) {
    console.log(`  id=${r.id} ${r.order}. "${r.name}" (${r.type}) pipelineId=${r.pipelineId}`);
  }

  console.log("\n[4] All candidate_rounds:");
  const allCandidateRounds = await db.select().from(candidateRounds);
  if (allCandidateRounds.length === 0) {
    console.log("  (none — no candidates have been enrolled yet)");
  } for (const cr of allCandidateRounds) {
    console.log(`  id=${cr.id} candidateId=${cr.candidateId} roundId=${cr.roundId} status=${cr.status}`);
  }

  console.log("\n[5] getPipelineByJobId verification (for Backend Developer):");
  const [backendJob] = await db.select().from(jobs).where(eq(jobs.title, "Backend Developer")).limit(1);
  if (backendJob) {
    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.jobId, backendJob.id)).limit(1);
    if (pipeline) {
      const rounds = await db.select().from(pipelineRounds).where(eq(pipelineRounds.pipelineId, pipeline.id)).orderBy(asc(pipelineRounds.order));
      console.log(`  Pipeline: "${pipeline.name}" (id=${pipeline.id})`);
      console.log(`  Rounds (${rounds.length}):`);
      for (const r of rounds) {
        console.log(`    ${r.order}. ${r.name} (${r.type}) config=${JSON.stringify(r.configuration)}`);
      }
    }
  }

  console.log("\n✓ Verification complete.");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
