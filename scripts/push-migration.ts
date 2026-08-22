/**
 * Direct migration push script.
 * Executes the SQL from drizzle/0001_light_celestials.sql directly via Neon.
 *
 * Usage: npx tsx scripts/push-migration.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("─".repeat(60));
  console.log("  Recrutva — Push Migration to Database");
  console.log("─".repeat(60));

  // Create tables (IF NOT EXISTS for safety)
  const statements = [
    `CREATE TABLE IF NOT EXISTS "candidate_rounds" (
      "id" serial PRIMARY KEY NOT NULL,
      "candidate_id" integer NOT NULL,
      "round_id" integer NOT NULL,
      "status" varchar(50) DEFAULT 'PENDING' NOT NULL,
      "score" integer,
      "feedback" text,
      "evaluation" jsonb,
      "started_at" timestamp,
      "completed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "pipeline_rounds" (
      "id" serial PRIMARY KEY NOT NULL,
      "pipeline_id" integer NOT NULL,
      "name" text NOT NULL,
      "type" varchar(50) NOT NULL,
      "order" integer NOT NULL,
      "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "pipelines" (
      "id" serial PRIMARY KEY NOT NULL,
      "job_id" integer NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,
    // Foreign keys — use DO block to only add if not exists
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'candidate_rounds_candidate_id_applicants_id_fk'
      ) THEN
        ALTER TABLE "candidate_rounds" ADD CONSTRAINT "candidate_rounds_candidate_id_applicants_id_fk"
          FOREIGN KEY ("candidate_id") REFERENCES "public"."applicants"("id") ON DELETE no action ON UPDATE no action;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'candidate_rounds_round_id_pipeline_rounds_id_fk'
      ) THEN
        ALTER TABLE "candidate_rounds" ADD CONSTRAINT "candidate_rounds_round_id_pipeline_rounds_id_fk"
          FOREIGN KEY ("round_id") REFERENCES "public"."pipeline_rounds"("id") ON DELETE no action ON UPDATE no action;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_rounds_pipeline_id_pipelines_id_fk'
      ) THEN
        ALTER TABLE "pipeline_rounds" ADD CONSTRAINT "pipeline_rounds_pipeline_id_pipelines_id_fk"
          FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pipelines_job_id_jobs_id_fk'
      ) THEN
        ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_job_id_jobs_id_fk"
          FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
      END IF;
    END $$`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const label = stmt.trim().substring(0, 60).replace(/\n/g, " ");
    console.log(`\n[${i + 1}/${statements.length}] ${label}...`);
    try {
      // Use sql.query() for raw SQL execution (DDL statements)
      await sql.query(stmt);
      console.log(`  ✓ Success`);
    } catch (err: any) {
      // "already exists" errors are OK
      if (err.message?.includes("already exists")) {
        console.log(`  ⏭ Already exists — skipping`);
      } else {
        console.error(`  ✗ Error: ${err.message}`);
      }
    }
  }

  // Verify tables
  console.log("\n" + "─".repeat(60));
  console.log("  Push complete. Verifying tables...");
  console.log("─".repeat(60));

  const checkTables = await sql.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('pipelines', 'pipeline_rounds', 'candidate_rounds')
    ORDER BY table_name
  `);

  console.log(`\n  Tables found: ${checkTables.length}/3`);
  for (const row of checkTables) {
    console.log(`    ✓ ${row.table_name}`);
  }

  if (checkTables.length === 3) {
    console.log("\n✓ All tables created successfully. Ready for seeding.");
  } else {
    console.error("\n✗ Some tables missing. Check errors above.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Push failed:", err);
  process.exit(1);
});
