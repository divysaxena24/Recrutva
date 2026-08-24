/**
 * Day 4 Full E2E Integration Test
 * 
 * Tests the complete pipeline system against real database data.
 */

import { db } from "../db";
import { jobs, applicants, pipelines, pipelineRounds, candidateRounds } from "../db/schema";
import { eq, and, asc } from "drizzle-orm";

let testResults: { test: string; status: "PASS" | "FAIL" | "SKIP"; details: string }[] = [];
let bugs: { severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; description: string; location: string; fix: string }[] = [];

function log(test: string, status: "PASS" | "FAIL" | "SKIP", details: string) {
  testResults.push({ test, status, details });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
  console.log(`${icon} ${test}: ${details}`);
}

function bug(severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW", description: string, location: string, fix: string) {
  bugs.push({ severity, description, location, fix });
  console.log(`🐛 BUG [${severity}]: ${description}`);
  console.log(`   Location: ${location}`);
  console.log(`   Fix: ${fix}`);
}

// ─── Cleanup Test Artifacts ───────────────────────────────────────
async function cleanupTestArtifacts() {
  console.log("\n🧹 CLEANUP TEST ARTIFACTS");
  console.log("─────────────────────────────────────────────────────────────");

  // Remove orphaned candidate rounds
  const orphanedCR = await db.delete(candidateRounds).where(
    eq(candidateRounds.candidateId, 13) // Fail test candidate
  );
  console.log(`  Removed ${orphanedCR.rowCount || 0} orphaned candidate rounds`);

  // Remove test candidate #13
  const deletedCandidate = await db.delete(applicants).where(eq(applicants.id, 13));
  console.log(`  Removed test candidate #13 (${deletedCandidate.rowCount || 0} rows)`);

  // Remove test pipeline #2
  const deletedPipeline = await db.delete(pipelines).where(eq(pipelines.id, 2));
  console.log(`  Removed test pipeline #2 (${deletedPipeline.rowCount || 0} rows)`);

  log("Cleanup", "PASS", "Test artifacts removed");
}

// ─── Test 1: Candidate Creation + Pipeline Enrollment ─────────────
async function testCandidateEnrollment() {
  console.log("\n📝 TEST 1: CANDIDATE CREATION + PIPELINE ENROLLMENT");
  console.log("─────────────────────────────────────────────────────────────");

  // Find job #1017 (Backend Developer) with its pipeline
  const [job] = await db.select().from(jobs).where(eq(jobs.id, 1017)).limit(1);
  if (!job) {
    log("Test 1: Job exists", "FAIL", "Job #1017 not found");
    return;
  }
  log("Test 1: Job exists", "PASS", `Job #${job.id}: "${job.title}"`);

  const [pipeline] = await db.select().from(pipelines)
    .where(eq(pipelines.jobId, job.id))
    .limit(1);
  if (!pipeline) {
    log("Test 1: Pipeline exists", "FAIL", "No pipeline for job #1017");
    return;
  }
  log("Test 1: Pipeline exists", "PASS", `Pipeline #${pipeline.id}: "${pipeline.name}"`);

  // Check pipeline rounds
  const rounds = await db.select().from(pipelineRounds)
    .where(eq(pipelineRounds.pipelineId, pipeline.id))
    .orderBy(asc(pipelineRounds.order));

  if (rounds.length !== 4) {
    log("Test 1: Pipeline has 4 rounds", "FAIL", `Expected 4, got ${rounds.length}`);
    return;
  }
  log("Test 1: Pipeline has 4 rounds", "PASS", rounds.map(r => r.name).join(" → "));

  // Verify round types
  const expectedTypes = ["RESUME_SCREENING", "ASSESSMENT", "AI_INTERVIEW", "MANUAL_REVIEW"];
  const actualTypes = rounds.map(r => r.type);
  const typesMatch = expectedTypes.every((t, i) => actualTypes[i] === t);
  log("Test 1: Round types correct", typesMatch ? "PASS" : "FAIL",
    typesMatch ? "All round types match expected" : `Expected: ${expectedTypes.join(",")}, Got: ${actualTypes.join(",")}`);

  // Create a test candidate
  const [testCandidate] = await db.insert(applicants).values({
    userId: job.userId,
    targetJobId: job.id,
    name: "Day4 Test Candidate",
    email: `day4-test-${Date.now()}@test.com`,
    phone: "1234567890",
    resumeText: "Test resume for Day 4 E2E testing. Node.js, TypeScript, React experience.",
    status: "Ready",
  }).returning();

  log("Test 1: Candidate created", "PASS", `Candidate #${testCandidate.id}: "${testCandidate.name}"`);

  // Enroll in first pipeline round
  const firstRound = rounds[0];
  await db.insert(candidateRounds).values({
    candidateId: testCandidate.id,
    roundId: firstRound.id,
    status: "ACTIVE",
    startedAt: new Date(),
  });

  // Verify enrollment
  const [enrolled] = await db.select().from(candidateRounds)
    .where(
      and(
        eq(candidateRounds.candidateId, testCandidate.id),
        eq(candidateRounds.roundId, firstRound.id)
      )
    )
    .limit(1);

  if (enrolled && enrolled.status === "ACTIVE") {
    log("Test 1: First round ACTIVE", "PASS", `${firstRound.name} is ACTIVE for candidate #${testCandidate.id}`);
  } else {
    log("Test 1: First round ACTIVE", "FAIL", "Enrollment failed");
  }

  return testCandidate.id;
}

// ─── Test 2: Resume Screening → PASSED ────────────────────────────
async function testResumeScreening(candidateId: number) {
  console.log("\n📝 TEST 2: RESUME SCREENING → PASSED");
  console.log("─────────────────────────────────────────────────────────────");

  const { completeCandidateRound } = await import("../app/actions/candidate-pipeline");

  // Find the candidate_round for Resume Screening
  const [cr] = await db.select().from(candidateRounds)
    .where(eq(candidateRounds.candidateId, candidateId))
    .limit(1);

  if (!cr) {
    log("Test 2: Candidate round exists", "FAIL", "No candidate_round found");
    return;
  }

  // Verify it's the Resume Screening round
  const [round] = await db.select().from(pipelineRounds)
    .where(eq(pipelineRounds.id, cr.roundId))
    .limit(1);

  if (!round || round.type !== "RESUME_SCREENING") {
    log("Test 2: Current round is RESUME_SCREENING", "FAIL", `Current round is ${round?.type}`);
    return;
  }
  log("Test 2: Current round is RESUME_SCREENING", "PASS", `Round: "${round.name}" (${round.type})`);

  // Mark as PASSED
  const result = await completeCandidateRound({
    candidateRoundId: cr.id,
    status: "PASSED",
    score: 85,
    feedback: "Strong resume, good experience match",
  });

  if (!result.success) {
    log("Test 2: Complete round", "FAIL", result.error || "Unknown error");
    return;
  }
  log("Test 2: Complete round", "PASS", `Status: ${result.data?.status}, Next activated: ${result.data?.nextRoundActivated}`);

  // Verify Resume Screening is now PASSED
  const [afterCR] = await db.select().from(candidateRounds)
    .where(eq(candidateRounds.id, cr.id))
    .limit(1);

  if (afterCR?.status === "PASSED" && afterCR?.score === 85) {
    log("Test 2: Resume Screening PASSED", "PASS", `Score: ${afterCR.score}, Feedback: "${afterCR.feedback}"`);
  } else {
    log("Test 2: Resume Screening PASSED", "FAIL", `Status: ${afterCR?.status}, Score: ${afterCR?.score}`);
  }

  // Verify next round (AI Assessment) is ACTIVE
  if (result.data?.nextRoundActivated) {
    const [nextCR] = await db.select().from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.status, "ACTIVE")
        )
      )
      .limit(1);

    if (nextCR) {
      const [nextRound] = await db.select().from(pipelineRounds)
        .where(eq(pipelineRounds.id, nextCR.roundId))
        .limit(1);

      if (nextRound?.type === "ASSESSMENT") {
        log("Test 2: AI Assessment is ACTIVE", "PASS", `Next round: "${nextRound.name}" (${nextRound.type})`);
      } else {
        log("Test 2: AI Assessment is ACTIVE", "FAIL", `Next round is ${nextRound?.type}`);
      }
    } else {
      log("Test 2: AI Assessment is ACTIVE", "FAIL", "No ACTIVE round found after Resume Screening");
    }
  }
}

// ─── Test 3: AI Assessment → PASSED ───────────────────────────────
async function testAIAssessment(candidateId: number) {
  console.log("\n📝 TEST 3: AI ASSESSMENT → PASSED");
  console.log("─────────────────────────────────────────────────────────────");

  const { completeCandidateRound } = await import("../app/actions/candidate-pipeline");

  // Find the ACTIVE candidate_round (should be AI Assessment)
  const [cr] = await db.select().from(candidateRounds)
    .where(
      and(
        eq(candidateRounds.candidateId, candidateId),
        eq(candidateRounds.status, "ACTIVE")
      )
    )
    .limit(1);

  if (!cr) {
    log("Test 3: Active round found", "FAIL", "No ACTIVE candidate_round");
    return;
  }

  const [round] = await db.select().from(pipelineRounds)
    .where(eq(pipelineRounds.id, cr.roundId))
    .limit(1);

  if (!round || round.type !== "ASSESSMENT") {
    log("Test 3: Current round is ASSESSMENT", "FAIL", `Current round is ${round?.type}`);
    return;
  }
  log("Test 3: Current round is ASSESSMENT", "PASS", `Round: "${round.name}" (${round.type})`);

  // Mark as PASSED
  const result = await completeCandidateRound({
    candidateRoundId: cr.id,
    status: "PASSED",
    score: 78,
    feedback: "Good assessment results",
  });

  if (!result.success) {
    log("Test 3: Complete round", "FAIL", result.error || "Unknown error");
    return;
  }
  log("Test 3: Complete round", "PASS", `Status: ${result.data?.status}, Next activated: ${result.data?.nextRoundActivated}`);

  // Verify AI Interview is now ACTIVE
  if (result.data?.nextRoundActivated) {
    const [nextCR] = await db.select().from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.status, "ACTIVE")
        )
      )
      .limit(1);

    if (nextCR) {
      const [nextRound] = await db.select().from(pipelineRounds)
        .where(eq(pipelineRounds.id, nextCR.roundId))
        .limit(1);

      if (nextRound?.type === "AI_INTERVIEW") {
        log("Test 3: AI Interview is ACTIVE", "PASS", `Next round: "${nextRound.name}" (${nextRound.type})`);
      } else {
        log("Test 3: AI Interview is ACTIVE", "FAIL", `Next round is ${nextRound?.type}`);
      }
    } else {
      log("Test 3: AI Interview is ACTIVE", "FAIL", "No ACTIVE round found after AI Assessment");
    }
  }
}

// ─── Test 4: AI Interview Integration ─────────────────────────────
async function testAIInterviewIntegration(candidateId: number) {
  console.log("\n📝 TEST 4: AI INTERVIEW INTEGRATION");
  console.log("─────────────────────────────────────────────────────────────");

  // Verify candidate is linked to the correct job
  const [candidate] = await db.select().from(applicants)
    .where(eq(applicants.id, candidateId))
    .limit(1);

  if (!candidate) {
    log("Test 4: Candidate exists", "FAIL", "Candidate not found");
    return;
  }
  log("Test 4: Candidate exists", "PASS", `${candidate.name} (targetJobId: ${candidate.targetJobId})`);

  // Verify AI_INTERVIEW round exists in pipeline
  const [pipeline] = await db.select().from(pipelines)
    .where(eq(pipelines.jobId, candidate.targetJobId!))
    .limit(1);

  if (!pipeline) {
    log("Test 4: Pipeline exists", "FAIL", "No pipeline for candidate's job");
    return;
  }

  const [aiRound] = await db.select().from(pipelineRounds)
    .where(
      and(
        eq(pipelineRounds.pipelineId, pipeline.id),
        eq(pipelineRounds.type, "AI_INTERVIEW")
      )
    )
    .limit(1);

  if (!aiRound) {
    log("Test 4: AI_INTERVIEW round exists", "FAIL", "No AI_INTERVIEW round in pipeline");
    return;
  }
  log("Test 4: AI_INTERVIEW round exists", "PASS", `Round #${aiRound.id}: "${aiRound.name}" (${aiRound.type})`);

  // Test completeAIRound function
  const { completeAIRound } = await import("../app/actions/candidate-pipeline");

  const result = await completeAIRound({
    candidateId,
    score: 82,
    summary: "Strong technical interview performance",
    evaluation: {
      totalScore: 82,
      executiveSummary: "Strong technical interview performance",
      breakdown: [
        { question: "Test Q1", expectedAnswer: "Expected", userAnswer: "Given", marks: 8, feedback: "Good" },
      ],
    },
  });

  if (result.success) {
    log("Test 4: completeAIRound", "PASS", `Round status: ${result.data?.roundStatus}, Next activated: ${result.data?.nextRoundActivated}`);

    // Verify candidate_round was created/updated
    const [cr] = await db.select().from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, candidateId),
          eq(candidateRounds.roundId, aiRound.id)
        )
      )
      .limit(1);

    if (cr) {
      log("Test 4: candidate_round created", "PASS", `Status: ${cr.status}, Score: ${cr.score}, CompletedAt: ${cr.completedAt ? "set" : "null"}`);

      // Verify evaluation is stored
      if (cr.evaluation && typeof cr.evaluation === "object") {
        const evalObj = cr.evaluation as Record<string, unknown>;
        log("Test 4: evaluation stored", "PASS", `totalScore: ${evalObj.totalScore}, breakdown: ${Array.isArray(evalObj.breakdown) ? evalObj.breakdown.length + " items" : "missing"}`);
      } else {
        log("Test 4: evaluation stored", "FAIL", "evaluation field is null or invalid");
      }

      // Verify feedback (summary) is stored
      if (cr.feedback) {
        log("Test 4: feedback stored", "PASS", `feedback: "${cr.feedback}"`);
      } else {
        log("Test 4: feedback stored", "FAIL", "feedback field is null");
      }
    } else {
      log("Test 4: candidate_round created", "FAIL", "No candidate_round record found");
    }

    // Verify next round activation
    if (result.data?.nextRoundActivated) {
      const [nextCR] = await db.select().from(candidateRounds)
        .where(
          and(
            eq(candidateRounds.candidateId, candidateId),
            eq(candidateRounds.status, "ACTIVE")
          )
        )
        .limit(1);

      if (nextCR) {
        const [nextRound] = await db.select().from(pipelineRounds)
          .where(eq(pipelineRounds.id, nextCR.roundId))
          .limit(1);

        if (nextRound?.type === "MANUAL_REVIEW") {
          log("Test 4: Final Review is ACTIVE", "PASS", `Next round: "${nextRound.name}" (${nextRound.type})`);
        } else {
          log("Test 4: Final Review is ACTIVE", "FAIL", `Next round is ${nextRound?.type}`);
        }
      } else {
        log("Test 4: Final Review is ACTIVE", "FAIL", "No ACTIVE round found");
      }
    }
  } else {
    log("Test 4: completeAIRound", "FAIL", result.error || "Unknown error");
  }
}

// ─── Test 5: AI Interview FAIL Path ───────────────────────────────
async function testAIFailPath() {
  console.log("\n📝 TEST 5: AI INTERVIEW FAIL PATH");
  console.log("─────────────────────────────────────────────────────────────");

  // Create a separate test candidate for fail path
  const [failCandidate] = await db.insert(applicants).values({
    userId: "user_3CikFLqoFwZEorAmXbFKqeagZQR",
    targetJobId: 1017,
    name: "Day4 Fail Test Candidate",
    email: `day4-fail-test-${Date.now()}@test.com`,
    phone: "0000000000",
    resumeText: "Test resume",
    status: "Ready",
  }).returning();

  log("Test 5: Create fail candidate", "PASS", `Candidate #${failCandidate.id}`);

  // Find the AI_INTERVIEW round
  const [aiRound] = await db.select().from(pipelineRounds)
    .where(eq(pipelineRounds.type, "AI_INTERVIEW"))
    .limit(1);

  if (!aiRound) {
    log("Test 5: AI_INTERVIEW round", "FAIL", "No AI_INTERVIEW round found");
    return;
  }

  // Enroll directly in AI_INTERVIEW round
  await db.insert(candidateRounds).values({
    candidateId: failCandidate.id,
    roundId: aiRound.id,
    status: "ACTIVE",
    startedAt: new Date(),
  });

  log("Test 5: Enrolled in AI_INTERVIEW", "PASS", `Round #${aiRound.id}`);

  // Test completeAIRound with failing score
  const { completeAIRound } = await import("../app/actions/candidate-pipeline");

  const result = await completeAIRound({
    candidateId: failCandidate.id,
    score: 35,
    summary: "Below average performance",
    evaluation: { totalScore: 35 },
  });

  if (result.success) {
    log("Test 5: completeAIRound (FAIL)", "PASS", `Round status: ${result.data?.roundStatus}, Next activated: ${result.data?.nextRoundActivated}`);

    // Verify the round is FAILED
    const [cr] = await db.select().from(candidateRounds)
      .where(
        and(
          eq(candidateRounds.candidateId, failCandidate.id),
          eq(candidateRounds.roundId, aiRound.id)
        )
      )
      .limit(1);

    if (cr?.status === "FAILED") {
      log("Test 5: AI_INTERVIEW is FAILED", "PASS", `Score: ${cr.score}`);
    } else {
      log("Test 5: AI_INTERVIEW is FAILED", "FAIL", `Status: ${cr?.status}`);
    }

    // Verify no next round was activated
    if (!result.data?.nextRoundActivated) {
      log("Test 5: No auto-advance on FAIL", "PASS", "Next round was NOT activated");
    } else {
      log("Test 5: No auto-advance on FAIL", "FAIL", "Next round was incorrectly activated");
      bug("HIGH", "AI Interview FAIL auto-advances to next round", "candidate-pipeline.ts:completeAIRound", "Check if next round activation logic is correct for FAIL status");
    }
  } else {
    log("Test 5: completeAIRound (FAIL)", "FAIL", result.error || "Unknown error");
  }

  // Cleanup
  await db.delete(candidateRounds).where(eq(candidateRounds.candidateId, failCandidate.id));
  await db.delete(applicants).where(eq(applicants.id, failCandidate.id));
  log("Test 5: Cleanup", "PASS", "Removed fail test candidate");
}

// ─── Test 6: Duplicate Prevention ─────────────────────────────────
async function testDuplicatePrevention(candidateId: number) {
  console.log("\n📝 TEST 6: DUPLICATE PREVENTION");
  console.log("─────────────────────────────────────────────────────────────");

  const { completeAIRound } = await import("../app/actions/candidate-pipeline");

  // Find the AI_INTERVIEW candidate_round (should already be completed)
  const [aiRound] = await db.select().from(pipelineRounds)
    .where(eq(pipelineRounds.type, "AI_INTERVIEW"))
    .limit(1);

  if (!aiRound) {
    log("Test 6: AI_INTERVIEW round", "SKIP", "No AI_INTERVIEW round");
    return;
  }

  const [existingCR] = await db.select().from(candidateRounds)
    .where(
      and(
        eq(candidateRounds.candidateId, candidateId),
        eq(candidateRounds.roundId, aiRound.id)
      )
    )
    .limit(1);

  if (!existingCR || (existingCR.status !== "PASSED" && existingCR.status !== "FAILED")) {
    log("Test 6: Completed round exists", "SKIP", "No completed AI_INTERVIEW round to test against");
    return;
  }

  const originalScore = existingCR.score;
  log("Test 6: Original score", "PASS", `${originalScore}`);

  // Try to complete again with a different score
  const result = await completeAIRound({
    candidateId,
    score: 99,
    summary: "Should not update",
    evaluation: { totalScore: 99 },
  });

  // Verify the original record was NOT updated
  const [afterCR] = await db.select().from(candidateRounds)
    .where(eq(candidateRounds.id, existingCR.id))
    .limit(1);

  if (afterCR?.score === originalScore) {
    log("Test 6: Duplicate prevention", "PASS", `Score unchanged (${afterCR.score}). Completed rounds not overwritten.`);
  } else {
    log("Test: Duplicate Prevention", "FAIL", `Score changed from ${originalScore} to ${afterCR?.score}. Completed round was overwritten!`);
    bug("CRITICAL", "Completed candidate_round overwritten on duplicate completion", "candidate-pipeline.ts:completeAIRound", "Add check: skip update if round already PASSED or FAILED");
  }
}

// ─── Test 7: Authorization Chain ──────────────────────────────────
async function testAuthorizationChain() {
  console.log("\n📝 TEST 7: AUTHORIZATION CHAIN");
  console.log("─────────────────────────────────────────────────────────────");

  const allCR = await db.select().from(candidateRounds);
  let validChains = 0;
  let brokenChains = 0;

  for (const cr of allCR) {
    const [round] = await db.select().from(pipelineRounds)
      .where(eq(pipelineRounds.id, cr.roundId))
      .limit(1);
    if (!round) { brokenChains++; continue; }

    const [pipeline] = await db.select().from(pipelines)
      .where(eq(pipelines.id, round.pipelineId))
      .limit(1);
    if (!pipeline) { brokenChains++; continue; }

    const [job] = await db.select().from(jobs)
      .where(eq(jobs.id, pipeline.jobId))
      .limit(1);
    if (!job) { brokenChains++; continue; }

    const [applicant] = await db.select().from(applicants)
      .where(eq(applicants.id, cr.candidateId))
      .limit(1);
    if (!applicant || applicant.targetJobId !== pipeline.jobId) { brokenChains++; continue; }

    validChains++;
  }

  if (brokenChains === 0) {
    log("Test 7: Authorization chain", "PASS", `All ${validChains} candidate rounds have valid ownership chains`);
  } else {
    log("Test 7: Authorization chain", "FAIL", `${brokenChains} broken chains out of ${allCR.length}`);
  }
}

// ─── Test 8: Code Review - Interview Integration ──────────────────
async function testInterviewIntegrationCode() {
  console.log("\n📝 TEST 8: INTERVIEW INTEGRATION CODE REVIEW");
  console.log("─────────────────────────────────────────────────────────────");

  const fs = await import("fs");
  const path = await import("path");

  const interviewCode = fs.readFileSync(
    path.resolve(__dirname, "../app/api/interview/complete/route.ts"),
    "utf-8"
  );

  // Check completeAIRound is called
  const hasAIRoundCall = interviewCode.includes("completeAIRound");
  log("Test 8: completeAIRound called", hasAIRoundCall ? "PASS" : "FAIL",
    hasAIRoundCall ? "Interview completion calls completeAIRound" : "Missing completeAIRound call");

  // Check error handling (non-blocking)
  const hasErrorHandling = interviewCode.includes("Pipeline round update failed (non-critical)");
  log("Test 8: Pipeline error non-blocking", hasErrorHandling ? "PASS" : "FAIL",
    hasErrorHandling ? "Pipeline errors don't block interview completion" : "Pipeline errors may block interview completion");

  // Check existing data preservation
  const preservesTranscript = interviewCode.includes("transcript: transcriptText");
  const preservesSummary = interviewCode.includes("summary: evaluation.executiveSummary");
  const preservesScore = interviewCode.includes("score: evaluation.totalScore");
  const preservesAnalysis = interviewCode.includes("analysis: evaluation");

  log("Test 8: Preserves transcript", preservesTranscript ? "PASS" : "FAIL",
    preservesTranscript ? "applicants.transcript still updated" : "Missing transcript preservation");
  log("Test 8: Preserves summary", preservesSummary ? "PASS" : "FAIL",
    preservesSummary ? "applicants.summary still updated" : "Missing summary preservation");
  log("Test 8: Preserves score", preservesScore ? "PASS" : "FAIL",
    preservesScore ? "applicants.score still updated" : "Missing score preservation");
  log("Test 8: Preserves analysis", preservesAnalysis ? "PASS" : "FAIL",
    preservesAnalysis ? "applicants.analysis still updated" : "Missing analysis preservation");

  // Check duplicate completion prevention
  const hasDupCheck = interviewCode.includes("ne(applicants.status, \"Completed\")");
  log("Test 8: Duplicate completion prevention", hasDupCheck ? "PASS" : "FAIL",
    hasDupCheck ? "Interview API prevents duplicate completions" : "Missing duplicate prevention");
}

// ─── Test 9: UI Component Verification ────────────────────────────
async function testUIComponents() {
  console.log("\n📝 TEST 9: UI COMPONENT VERIFICATION");
  console.log("─────────────────────────────────────────────────────────────");

  const fs = await import("fs");
  const path = await import("path");

  // CandidatePipelineCard
  const cardPath = path.resolve(__dirname, "../components/CandidatePipelineCard.tsx");
  if (fs.existsSync(cardPath)) {
    const cardCode = fs.readFileSync(cardPath, "utf-8");

    const checks = [
      ["getCandidatePipeline", "Fetches pipeline data"],
      ["completeCandidateRound", "Can mark rounds PASSED/FAILED"],
      ["moveCandidateToRound", "Can move candidates between rounds"],
      ["0-100", "Score validation"],
      ["Loading pipeline", "Loading state"],
      ["Failed to load pipeline", "Error state"],
      ["No pipeline configured", "Empty state"],
      ["PASSED", "PASSED status display"],
      ["ACTIVE", "ACTIVE status display"],
      ["FAILED", "FAILED status display"],
      ["SKIPPED", "SKIPPED status display"],
      ["NOT_STARTED", "NOT_STARTED status display"],
    ];

    for (const [pattern, desc] of checks) {
      const found = cardCode.includes(pattern);
      log(`Test 9: PipelineCard ${desc}`, found ? "PASS" : "FAIL",
        found ? `Found "${pattern}"` : `Missing "${pattern}"`);
    }
  } else {
    log("Test 9: CandidatePipelineCard", "FAIL", "File not found");
  }

  // Applications page
  const appsPath = path.resolve(__dirname, "../app/(dashboard)/jobs/[id]/applications/page.tsx");
  if (fs.existsSync(appsPath)) {
    const appsCode = fs.readFileSync(appsPath, "utf-8");
    log("Test 9: Apps page imports PipelineCard", appsCode.includes("CandidatePipelineCard") ? "PASS" : "FAIL",
      appsCode.includes("CandidatePipelineCard") ? "Imported" : "Missing import");
    log("Test 9: Apps page has expandable rows", appsCode.includes("expandedCandidateId") ? "PASS" : "FAIL",
      appsCode.includes("expandedCandidateId") ? "Expandable rows present" : "Missing expandable rows");
  }

  // Candidates page
  const candPath = path.resolve(__dirname, "../app/(dashboard)/dashboard/candidates/page.tsx");
  if (fs.existsSync(candPath)) {
    const candCode = fs.readFileSync(candPath, "utf-8");
    log("Test 9: Cand page imports PipelineCard", candCode.includes("CandidatePipelineCard") ? "PASS" : "FAIL",
      candCode.includes("CandidatePipelineCard") ? "Imported" : "Missing import");
    log("Test 9: Cand page has expandable rows", candCode.includes("expandedCandidateId") ? "PASS" : "FAIL",
      candCode.includes("expandedCandidateId") ? "Expandable rows present" : "Missing expandable rows");
  }
}

// ─── Test 10: State Transitions Summary ───────────────────────────
async function testStateTransitions(candidateId: number) {
  console.log("\n📝 TEST 10: STATE TRANSITIONS SUMMARY");
  console.log("─────────────────────────────────────────────────────────────");

  const allCR = await db.select().from(candidateRounds)
    .where(eq(candidateRounds.candidateId, candidateId));

  const allRounds = await db.select().from(pipelineRounds)
    .orderBy(asc(pipelineRounds.order));

  const roundMap = new Map(allRounds.map(r => [r.id, r]));
  const crMap = new Map(allCR.map(cr => [cr.roundId, cr]));

  console.log("\n  Pipeline State for Candidate #" + candidateId + ":");
  console.log("  ─────────────────────────────────────────────────────");

  for (const round of allRounds) {
    const cr = crMap.get(round.id);
    const status = cr?.status || "NOT_ENROLLED";
    const score = cr?.score !== null && cr?.score !== undefined ? ` (score: ${cr.score})` : "";
    const icon = status === "PASSED" ? "✅" : status === "ACTIVE" ? "●" : status === "FAILED" ? "❌" : status === "NOT_ENROLLED" ? "○" : "—";
    console.log(`  ${icon} ${round.name.padEnd(20)} ${status.padEnd(12)}${score}`);
  }

  // Verify expected state
  const resumeScreening = crMap.get(allRounds[0]?.id);
  const aiAssessment = crMap.get(allRounds[1]?.id);
  const aiInterview = crMap.get(allRounds[2]?.id);
  const finalReview = crMap.get(allRounds[3]?.id);

  const stateCorrect =
    resumeScreening?.status === "PASSED" &&
    aiAssessment?.status === "PASSED" &&
    aiInterview?.status === "PASSED" &&
    finalReview?.status === "ACTIVE";

  log("Test 10: State transitions correct", stateCorrect ? "PASS" : "FAIL",
    stateCorrect ? "All transitions as expected" : "State transitions don't match expected pattern");
}

// ─── Run All Tests ────────────────────────────────────────────────
async function runAllTests() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DAY 4 E2E INTEGRATION TEST SUITE");
  console.log("═══════════════════════════════════════════════════════════════");

  await cleanupTestArtifacts();

  const candidateId = await testCandidateEnrollment();
  if (candidateId) {
    await testResumeScreening(candidateId);
    await testAIAssessment(candidateId);
    await testAIInterviewIntegration(candidateId);
    await testDuplicatePrevention(candidateId);
    await testStateTransitions(candidateId);
  }

  await testAIFailPath();
  await testAuthorizationChain();
  await testInterviewIntegrationCode();
  await testUIComponents();

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  TEST SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const passed = testResults.filter(r => r.status === "PASS").length;
  const failed = testResults.filter(r => r.status === "FAIL").length;
  const skipped = testResults.filter(r => r.status === "SKIP").length;

  console.log(`✅ PASS: ${passed}`);
  console.log(`❌ FAIL: ${failed}`);
  console.log(`⏭️  SKIP: ${skipped}`);
  console.log(`📊 TOTAL: ${testResults.length}`);

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    testResults.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  - ${r.test}: ${r.details}`);
    });
  }

  if (bugs.length > 0) {
    console.log("\n🐛 BUGS FOUND:");
    bugs.forEach(b => {
      console.log(`  [${b.severity}] ${b.description}`);
      console.log(`    Location: ${b.location}`);
      console.log(`    Fix: ${b.fix}`);
    });
  } else {
    console.log("\n🎉 No bugs found!");
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
}

runAllTests().catch(console.error);
