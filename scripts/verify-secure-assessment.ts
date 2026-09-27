import "dotenv/config";
import { parseSecureConfig } from "../lib/assessment-security";
import { generateTechnicalInterviewQuestions } from "../lib/technical-interview";

async function main() {
  console.log("=========================================");
  console.log("SECURE ASSESSMENT ENVIRONMENT VERIFICATION");
  console.log("=========================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
    }
  }

  // Test A: Security Configuration Defaults
  const defaultConfig = parseSecureConfig({}, "ASSESSMENT");
  assert(defaultConfig.secureMode === true, "Default secureMode is true for ASSESSMENT");
  assert(defaultConfig.requireFullscreen === true, "Default requireFullscreen is true");
  assert(defaultConfig.maxViolations === 3, "Default maxViolations is 3");
  assert(defaultConfig.recordVisibilityChanges === true, "Default recordVisibilityChanges is true");
  assert(defaultConfig.recordFullscreenExits === true, "Default recordFullscreenExits is true");

  // Test B: Non-candidate facing rounds (RESUME_SCREENING)
  const screeningConfig = parseSecureConfig({}, "RESUME_SCREENING");
  assert(screeningConfig.secureMode === false, "secureMode defaults to false for RESUME_SCREENING");

  // Test C: Custom Configuration Override
  const customConfig = parseSecureConfig(
    {
      secureMode: true,
      maxViolations: 5,
      durationMinutes: 45,
    },
    "AI_INTERVIEW"
  );
  assert(customConfig.secureMode === true, "Custom secureMode override parsed");
  assert(customConfig.maxViolations === 5, "Custom maxViolations = 5 parsed");
  assert(customConfig.durationMinutes === 45, "Custom durationMinutes = 45 parsed");

  // Test D: Technical Interview Question Categories (1 DSA, 3 OS, 3 DBMS, 3 OOPS)
  console.log("\nTesting Technical Interview Question Generator...");
  const questionsRes = await generateTechnicalInterviewQuestions({
    jobTitle: "Senior Software Engineer",
    jobDescription: "Build scalable web applications, design PostgreSQL schemas, optimize OS concurrency, and implement OOP design patterns.",
  });

  assert(questionsRes.success === true, "Technical interview questions generated successfully");
  if (questionsRes.success) {
    const questions = questionsRes.questions;
    assert(questions.length === 10, "Generated exactly 10 questions");
    const dsaCount = questions.filter((q) => q.category === "DSA").length;
    const osCount = questions.filter((q) => q.category === "OS").length;
    const dbmsCount = questions.filter((q) => q.category === "DBMS").length;
    const oopsCount = questions.filter((q) => q.category === "OOPS").length;

    assert(dsaCount >= 1, `DSA questions count = ${dsaCount} (expected 1)`);
    assert(osCount >= 2, `OS questions count = ${osCount} (expected ~3)`);
    assert(dbmsCount >= 2, `DBMS questions count = ${dbmsCount} (expected ~3)`);
    assert(oopsCount >= 2, `OOPS questions count = ${oopsCount} (expected ~3)`);
  }

  console.log("\n-----------------------------------------");
  console.log(`Verification Summary: ${passedTests} / ${totalTests} tests passed.`);
  console.log("-----------------------------------------");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
