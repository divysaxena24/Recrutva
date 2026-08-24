/**
 * Day 4 Database Investigation Script
 * 
 * Investigates the actual state of the database to understand
 * pipeline-candidate-job relationships.
 */

import { db } from "../db";
import { jobs, applicants, pipelines, pipelineRounds, candidateRounds } from "../db/schema";
import { eq, asc } from "drizzle-orm";

async function investigate() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DATABASE STATE INVESTIGATION");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. All Jobs
  const allJobs = await db.select().from(jobs);
  console.log("📋 JOBS:");
  for (const job of allJobs) {
    console.log(`  #${job.id}: "${job.title}" (userId: ${job.userId})`);
  }

  // 2. All Pipelines
  const allPipelines = await db.select().from(pipelines);
  console.log("\n🔄 PIPELINES:");
  for (const p of allPipelines) {
    console.log(`  #${p.id}: "${p.name}" → jobId: ${p.jobId}`);
  }

  // 3. All Pipeline Rounds
  const allRounds = await db.select().from(pipelineRounds).orderBy(asc(pipelineRounds.order));
  console.log("\n🎯 PIPELINE ROUNDS:");
  for (const r of allRounds) {
    console.log(`  #${r.id}: "${r.name}" (${r.type}) order:${r.order} → pipelineId: ${r.pipelineId}`);
  }

  // 4. All Applicants
  const allApplicants = await db.select().from(applicants);
  console.log("\n👥 APPLICANTS:");
  for (const a of allApplicants) {
    console.log(`  #${a.id}: "${a.name}" (${a.email}) status:${a.status} targetJobId:${a.targetJobId}`);
  }

  // 5. All Candidate Rounds
  const allCR = await db.select().from(candidateRounds);
  console.log("\n📊 CANDIDATE ROUNDS:");
  if (allCR.length === 0) {
    console.log("  (none)");
  } else {
    for (const cr of allCR) {
      console.log(`  #${cr.id}: candidateId:${cr.candidateId} roundId:${cr.roundId} status:${cr.status} score:${cr.score}`);
    }
  }

  // 6. Pipeline-Candidate Mapping
  console.log("\n🔗 PIPELINE → CANDIDATE MAPPING:");
  for (const pipeline of allPipelines) {
    const rounds = allRounds.filter(r => r.pipelineId === pipeline.id);
    const job = allJobs.find(j => j.id === pipeline.jobId);
    const candidates = allApplicants.filter(a => a.targetJobId === pipeline.jobId);
    
    console.log(`\n  Pipeline #${pipeline.id} "${pipeline.name}" → Job: "${job?.title}" (jobId:${pipeline.jobId})`);
    console.log(`    Rounds: ${rounds.map(r => `${r.name}(${r.type})`).join(", ")}`);
    console.log(`    Candidates: ${candidates.map(c => `#${c.id} ${c.name}`).join(", ") || "(none)"}`);
    
    for (const candidate of candidates) {
      const candidateRoundsForCandidate = allCR.filter(cr => cr.candidateId === candidate.id);
      if (candidateRoundsForCandidate.length > 0) {
        console.log(`      ${candidate.name} rounds: ${candidateRoundsForCandidate.map(cr => {
          const round = allRounds.find(r => r.id === cr.roundId);
          return `${round?.name}(${cr.status})`;
        }).join(", ")}`);
      } else {
        console.log(`      ${candidate.name}: NOT ENROLLED in pipeline`);
      }
    }
  }

  // 7. Check for orphaned data
  console.log("\n⚠️  ORPHANED DATA CHECK:");
  
  // Pipelines pointing to non-existent jobs
  const orphanedPipelines = allPipelines.filter(p => !allJobs.find(j => j.id === p.jobId));
  console.log(`  Orphaned pipelines: ${orphanedPipelines.length}`);
  
  // Rounds pointing to non-existent pipelines
  const orphanedRounds = allRounds.filter(r => !allPipelines.find(p => p.id === r.pipelineId));
  console.log(`  Orphaned rounds: ${orphanedRounds.length}`);
  
  // Candidate rounds pointing to non-existent candidates or rounds
  const orphanedCR = allCR.filter(cr => 
    !allApplicants.find(a => a.id === cr.candidateId) ||
    !allRounds.find(r => r.id === cr.roundId)
  );
  console.log(`  Orphaned candidate rounds: ${orphanedCR.length}`);

  // 8. Test Candidate #1 details
  console.log("\n🔍 CANDIDATE #1 DETAILED:");
  const [c1] = await db.select().from(applicants).where(eq(applicants.id, 1)).limit(1);
  if (c1) {
    console.log(`  Name: ${c1.name}`);
    console.log(`  Email: ${c1.email}`);
    console.log(`  Status: ${c1.status}`);
    console.log(`  targetJobId: ${c1.targetJobId}`);
    console.log(`  matchScore: ${c1.matchScore}`);
    console.log(`  score: ${c1.score}`);
    console.log(`  Has transcript: ${c1.transcript ? "yes" : "no"}`);
    console.log(`  Has summary: ${c1.summary ? "yes" : "no"}`);
    console.log(`  Has analysis: ${c1.analysis ? "yes" : "no"}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
}

investigate().catch(console.error);
