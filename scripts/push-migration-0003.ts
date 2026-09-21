/**
 * Direct migration push script for drizzle/0003_job_description_fields.sql.
 *
 * The AI Job Description workflow stores structured JD sections alongside the
 * rendered `description` text, so these columns must exist before drafts or
 * published jobs can be written.
 *
 * Every statement is guarded, so the script is safe to re-run.
 *
 * Usage: npx tsx scripts/push-migration-0003.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const columns: Array<{ name: string; type: string }> = [
  { name: "department", type: "text" },
  { name: "employment_type", type: "varchar(50)" },
  { name: "experience", type: "varchar(100)" },
  { name: "work_mode", type: "varchar(50)" },
  { name: "salary_range", type: "varchar(100)" },
  { name: "summary", type: "text" },
  { name: "responsibilities", type: "jsonb" },
  { name: "required_skills", type: "jsonb" },
  { name: "preferred_skills", type: "jsonb" },
  { name: "qualifications", type: "jsonb" },
  { name: "benefits", type: "jsonb" },
  { name: "source_input", type: "jsonb" },
  { name: "updated_at", type: "timestamp DEFAULT now() NOT NULL" },
];

async function main() {
  console.log("─".repeat(60));
  console.log("  Recrutva — Push Migration 0003");
  console.log("─".repeat(60));

  for (let i = 0; i < columns.length; i++) {
    const { name, type } = columns[i];
    console.log(`\n[${i + 1}/${columns.length}] add "jobs"."${name}"...`);
    try {
      await sql.query(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
      console.log("  ✓ Success");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Error: ${message}`);
      throw err;
    }
  }

  // Verify the schema matches db/schema.ts
  console.log("\n" + "─".repeat(60));
  console.log("  Verifying schema...");
  console.log("─".repeat(60));

  const rows = await sql.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'jobs'`
  );
  const present = new Set(rows.map((r) => r.column_name as string));

  console.log("");
  let missing = 0;
  for (const { name } of columns) {
    const ok = present.has(name);
    if (!ok) missing++;
    console.log(`  jobs.${name.padEnd(20)} ${ok ? "✓" : "✗ MISSING"}`);
  }

  if (missing > 0) {
    console.error(`\n✗ ${missing} column(s) still missing. Check errors above.`);
    process.exit(1);
  }

  console.log("\n✓ Migration 0003 applied. Job descriptions can be stored.");
}

main().catch((err) => {
  console.error("Push failed:", err);
  process.exit(1);
});
