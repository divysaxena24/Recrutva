import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Starting DB initialization for interview scheduling system...");

  try {
    // 1. Create schedule_status enum if it doesn't exist
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "schedule_status" AS ENUM ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'MISSED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✅ Enum schedule_status verified/created.");

    // 2. Create schedules table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "schedules" (
        "id" SERIAL PRIMARY KEY,
        "candidate_id" INTEGER NOT NULL REFERENCES "applicants"("id") ON DELETE CASCADE,
        "candidate_round_id" INTEGER REFERENCES "candidate_rounds"("id") ON DELETE SET NULL,
        "recruiter_user_id" VARCHAR(255) NOT NULL,
        "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "duration_minutes" INTEGER DEFAULT 45 NOT NULL,
        "timezone" VARCHAR(100) DEFAULT 'Asia/Kolkata' NOT NULL,
        "status" "schedule_status" DEFAULT 'SCHEDULED' NOT NULL,
        "meeting_provider" VARCHAR(50) DEFAULT 'INTERNAL' NOT NULL,
        "meeting_url" TEXT,
        "cancellation_reason" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("✅ Table schedules verified/created.");

    // 3. Create schedule_logs table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "schedule_logs" (
        "id" SERIAL PRIMARY KEY,
        "schedule_id" INTEGER NOT NULL REFERENCES "schedules"("id") ON DELETE CASCADE,
        "action" VARCHAR(50) NOT NULL,
        "previous_scheduled_at" TIMESTAMP WITH TIME ZONE,
        "new_scheduled_at" TIMESTAMP WITH TIME ZONE,
        "previous_status" VARCHAR(50),
        "new_status" VARCHAR(50),
        "changed_by_user_id" VARCHAR(255) NOT NULL,
        "reason" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("✅ Table schedule_logs verified/created.");

    // 4. Legacy Migration: Convert existing applicants.scheduledAt into schedules entries
    const legacyApplicants = await db.execute(sql`
      SELECT a.id, a.user_id, a.scheduled_at, a.status, a.target_job_id, a.created_at
      FROM applicants a
      WHERE a.scheduled_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM schedules s WHERE s.candidate_id = a.id
        );
    `);

    const rows = legacyApplicants.rows as {
      id: number;
      user_id: string;
      scheduled_at: Date | string;
      status: string;
      target_job_id: number | null;
      created_at: Date | string;
    }[];

    console.log(`Found ${rows.length} legacy scheduled candidates to migrate...`);

    for (const applicant of rows) {
      // Find candidate_round if available
      const crResult = await db.execute(sql`
        SELECT id FROM candidate_rounds
        WHERE candidate_id = ${applicant.id}
        ORDER BY id ASC
        LIMIT 1;
      `);

      const candidateRoundId = crResult.rows[0]?.id ? (crResult.rows[0].id as number) : null;
      const scheduledDate = new Date(applicant.scheduled_at);
      const now = new Date();

      let status: "SCHEDULED" | "COMPLETED" | "MISSED" = "SCHEDULED";
      if (applicant.status === "Completed") {
        status = "COMPLETED";
      } else if (scheduledDate < now) {
        status = "MISSED";
      }

      const inserted = await db.execute(sql`
        INSERT INTO schedules (
          candidate_id,
          candidate_round_id,
          recruiter_user_id,
          scheduled_at,
          duration_minutes,
          timezone,
          status,
          meeting_provider,
          meeting_url,
          created_at,
          updated_at
        ) VALUES (
          ${applicant.id},
          ${candidateRoundId},
          ${applicant.user_id},
          ${scheduledDate.toISOString()},
          45,
          'Asia/Kolkata',
          ${status},
          'INTERNAL',
          ${`/interview/${applicant.id}`},
          NOW(),
          NOW()
        )
        RETURNING id;
      `);

      const scheduleId = inserted.rows[0]?.id as number;

      if (scheduleId) {
        await db.execute(sql`
          INSERT INTO schedule_logs (
            schedule_id,
            action,
            new_scheduled_at,
            new_status,
            changed_by_user_id,
            reason
          ) VALUES (
            ${scheduleId},
            'MIGRATED_FROM_LEGACY',
            ${scheduledDate.toISOString()},
            ${status},
            ${applicant.user_id},
            'Migrated from legacy applicants.scheduledAt'
          );
        `);
      }
    }

    console.log("🎉 Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing scheduling database tables:", error);
    process.exit(1);
  }
}

main();
