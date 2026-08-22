/**
 * Seed script: Add test pipeline rounds for Day 4 testing.
 *
 * Usage: npx tsx scripts/seed-test-pipeline.ts
 *
 * This script:
 * 1. Finds the "Backend Developer" job (or the most recent job if not found)
 * 2. Creates a pipeline if one doesn't exist for the job
 * 3. Creates the default "Resume Screening" round if missing
 * 4. Adds 3 additional rounds for testing
 */

import { config } from "dotenv";
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { jobs, pipelines, pipelineRounds } from "../db/schema";
import { eq, asc } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log("─".repeat(60));
  console.log("  Recrutva — Seed Test Pipeline Rounds");
  console.log("─".repeat(60));

  // ── Step 1: Find the test job ──────────────────────────────────

  console.log("\n[1/5] Looking for 'Backend Developer' job...");

  let [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.title, "Backend Developer"))
    .limit(1);

  if (!job) {
    console.log("  ⚠ 'Backend Developer' not found. Using most recent job...");
    const [recentJob] = await db
      .select()
      .from(jobs)
      .orderBy(jobs.createdAt)
      .limit(1);

    if (!recentJob) {
      console.error("  ✗ No jobs found in database. Create a job first.");
      process.exit(1);
    }

    job = recentJob;
  }

  console.log(`  ✓ Found job: "${job.title}" (id: ${job.id})`);

  // ── Step 2: Find or create pipeline ────────────────────────────

  console.log("\n[2/5] Looking for pipeline...");

  let [pipeline] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.jobId, job.id))
    .limit(1);

  if (!pipeline) {
    console.log("  ⚠ No pipeline found. Creating one...");
    const [newPipeline] = await db
      .insert(pipelines)
      .values({
        jobId: job.id,
        name: `${job.title} Pipeline`,
      })
      .returning();

    pipeline = newPipeline;
    console.log(`  ✓ Created pipeline: "${pipeline.name}" (id: ${pipeline.id})`);
  } else {
    console.log(`  ✓ Found pipeline: "${pipeline.name}" (id: ${pipeline.id})`);
  }

  // ── Step 3: Check existing rounds ──────────────────────────────

  console.log("\n[3/5] Checking existing rounds...");

  const existingRounds = await db
    .select()
    .from(pipelineRounds)
    .where(eq(pipelineRounds.pipelineId, pipeline.id))
    .orderBy(asc(pipelineRounds.order));

  console.log(`  Current rounds: ${existingRounds.length}`);
  for (const round of existingRounds) {
    console.log(`    ${round.order}. ${round.name} (${round.type})`);
  }

  // ── Step 4: Ensure default round exists ────────────────────────

  console.log("\n[4/5] Ensuring default Resume Screening round...");

  const existingNames = new Set(existingRounds.map((r) => r.name));

  if (!existingNames.has("Resume Screening")) {
    await db.insert(pipelineRounds).values({
      pipelineId: pipeline.id,
      name: "Resume Screening",
      type: "RESUME_SCREENING",
      order: 1,
      configuration: {},
    });
    console.log(`  ✓ Added: 1. Resume Screening (RESUME_SCREENING)`);
    existingNames.add("Resume Screening");
  } else {
    console.log(`  ⏭ "Resume Screening" already exists — skipping`);
  }

  // ── Step 5: Add additional test rounds ─────────────────────────

  console.log("\n[5/5] Adding test rounds...");

  const roundsToAdd = [
    {
      name: "AI Assessment",
      type: "ASSESSMENT",
      order: 2,
      configuration: { passingScore: 60 },
    },
    {
      name: "AI Interview",
      type: "AI_INTERVIEW",
      order: 3,
      configuration: { questionCount: 10, timeLimitMinutes: 30 },
    },
    {
      name: "Final Review",
      type: "MANUAL_REVIEW",
      order: 4,
      configuration: {},
    },
  ];

  for (const round of roundsToAdd) {
    if (existingNames.has(round.name)) {
      console.log(`  ⏭ "${round.name}" already exists — skipping`);
      continue;
    }

    await db.insert(pipelineRounds).values({
      pipelineId: pipeline.id,
      name: round.name,
      type: round.type,
      order: round.order,
      configuration: round.configuration,
    });

    console.log(`  ✓ Added: ${round.order}. ${round.name} (${round.type})`);
  }

  // ── Final verification ─────────────────────────────────────────

  console.log("\n" + "─".repeat(60));
  console.log("  Verification — All rounds in pipeline:");
  console.log("─".repeat(60));

  const allRounds = await db
    .select()
    .from(pipelineRounds)
    .where(eq(pipelineRounds.pipelineId, pipeline.id))
    .orderBy(asc(pipelineRounds.order));

  console.log(`\n  Pipeline: "${pipeline.name}" (id: ${pipeline.id})`);
  console.log(`  Job: "${job.title}" (id: ${job.id})\n`);

  console.log("  ┌───────┬──────────────────┬────────────────────┐");
  console.log("  │ Order │ Name             │ Type               │");
  console.log("  ├───────┼──────────────────┼────────────────────┤");

  for (const round of allRounds) {
    const order = String(round.order).padStart(3);
    const name = round.name.padEnd(16);
    const type = round.type.padEnd(18);
    console.log(`  │ ${order}  │ ${name} │ ${type} │`);
  }

  console.log("  └───────┴──────────────────┴────────────────────┘");
  console.log(`\n  Total rounds: ${allRounds.length}`);
  console.log("\n✓ Seed complete. Ready for Day 4 testing.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
