/**
 * Direct migration push script for adding `expires_at` column to `jobs`.
 *
 * Usage: npx tsx scripts/push-migration-0004.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { configureNeonHttp } from "../lib/neon-fetch";

configureNeonHttp();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("─".repeat(60));
  console.log("  Recrutva — Push Migration 0004 (Job expires_at)");
  console.log("─".repeat(60));

  try {
    await sql.query(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone`);
    console.log("  ✓ Success adding jobs.expires_at");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Error: ${message}`);
    throw err;
  }

  // Verify
  const rows = await sql.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'expires_at'`
  );

  if (rows.length > 0) {
    console.log("✓ Migration 0004 applied successfully. jobs.expires_at column exists.");
  } else {
    console.error("✗ Column jobs.expires_at was not found!");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Push failed:", err);
  process.exit(1);
});
