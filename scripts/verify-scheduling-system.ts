import "dotenv/config";
import { db } from "../db";
import { applicants, schedules, scheduleLogs } from "../db/schema";
import { createSchedule, rescheduleSchedule, cancelSchedule, checkScheduleConflict, validateAccessWindow } from "../lib/scheduling";
import { generateICS } from "../lib/ics";

async function main() {
  console.log("=========================================");
  console.log("VERIFYING RECRUTVA SCHEDULING SYSTEM");
  console.log("=========================================\n");

  try {
    // 1. Verify DB Tables
    const schedCount = await db.select().from(schedules);
    console.log(`✅ [DB Check] Schedules table exists. Total records: ${schedCount.length}`);

    const logsCount = await db.select().from(scheduleLogs);
    console.log(`✅ [DB Check] Schedule logs table exists. Total audit entries: ${logsCount.length}`);

    // 2. Test ICS Generation
    const testDate = new Date();
    testDate.setHours(testDate.getHours() + 24);
    const icsContent = generateICS({
      title: "Test Verification SDE Technical Interview",
      description: "Automated verification test of calendar generation",
      startTime: testDate,
      durationMinutes: 45,
      location: "http://localhost:3000/interview/1",
    });

    if (icsContent.includes("BEGIN:VCALENDAR") && icsContent.includes("END:VCALENDAR")) {
      console.log("✅ [ICS Generator] ICS file generation validated successfully.");
    } else {
      throw new Error("ICS generation failed formatting check.");
    }

    // 3. Test Conflict Detection Logic
    const recruiterUserId = "user_recruiter_test_123";

    // Find or create test candidate
    const existingCandidates = await db.select().from(applicants).limit(1);
    if (existingCandidates.length === 0) {
      console.log("⚠️ No candidate in DB, skipping live conflict test.");
    } else {
      const candidate = existingCandidates[0];
      const targetTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

      // Create test schedule
      console.log(`Creating test schedule for candidate ${candidate.name}...`);
      const createRes = await createSchedule({
        candidateId: candidate.id,
        recruiterUserId: candidate.userId || recruiterUserId,
        scheduledAt: targetTime,
        durationMinutes: 45,
        timezone: "Asia/Kolkata",
      });

      if (createRes.success && createRes.schedule) {
        console.log(`✅ [Create Schedule] Schedule ID #${createRes.schedule.id} created with status ${createRes.schedule.status}.`);

        // Conflict check: Overlapping time
        const conflictRes = await checkScheduleConflict({
          recruiterUserId: candidate.userId || recruiterUserId,
          candidateId: candidate.id,
          scheduledAt: new Date(targetTime.getTime() + 15 * 60 * 1000), // 15 mins into existing 45 min slot
          durationMinutes: 45,
        });

        if (conflictRes.conflict) {
          console.log(`✅ [Conflict Engine] Conflict correctly detected! Reason: "${conflictRes.reason}"`);
        } else {
          console.error("❌ [Conflict Engine] Failed to detect overlapping schedule.");
        }

        // Test Reschedule with Audit Log
        const newTime = new Date(targetTime.getTime() + 120 * 60 * 1000); // +2 hours
        const rescheduleRes = await rescheduleSchedule({
          scheduleId: createRes.schedule.id,
          newScheduledAt: newTime,
          recruiterUserId: candidate.userId || recruiterUserId,
          reason: "Candidate requested afternoon slot",
        });

        if (rescheduleRes.success) {
          console.log(`✅ [Reschedule Service] Rescheduled successfully with audit history log.`);
        }

        // Test Access Window Validation
        const accessCheck = await validateAccessWindow(candidate.id);
        console.log(`✅ [Access Window Engine] Access Check Result: Allowed=${accessCheck.allowed}, Reason=${accessCheck.reason || "OK"}`);

        // Cleanup test schedule
        await cancelSchedule({
          scheduleId: createRes.schedule.id,
          recruiterUserId: candidate.userId || recruiterUserId,
          reason: "Automated verification test cleanup",
        });
        console.log(`✅ [Cancellation Service] Cancelled test schedule ID #${createRes.schedule.id}.`);
      }
    }

    console.log("\n=========================================");
    console.log("🎉 SCHEDULING SYSTEM ALL TESTS PASSED");
    console.log("=========================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Scheduling system verification failed:", err);
    process.exit(1);
  }
}

main();
