/**
 * Direct migration push script for drizzle/0002_add_role_and_clerk_user_id.sql.
 *
 * The `role` column, the `user_role` enum and `applicants.clerk_user_id` are
 * referenced by db/schema.ts and lib/auth.ts, so onboarding cannot persist a
 * role until this migration has been applied to the target database.
 *
 * Every statement is guarded, so the script is safe to re-run.
 *
 * Usage: npx tsx scripts/push-migration-0002.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { configureNeonHttp } from "../lib/neon-fetch";

// Use the host from DATABASE_URL directly (and retry transient failures)
// instead of the driver's legacy `api.<region>.neon.tech` endpoint.
configureNeonHttp();

const sql = neon(process.env.DATABASE_URL!);

const statements: Array<{ label: string; sql: string }> = [
  {
    label: 'create type "user_role"',
    sql: `DO $$ BEGIN
      CREATE TYPE "user_role" AS ENUM ('RECRUITER', 'CANDIDATE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$`,
  },
  {
    label: 'add "users"."role" column',
    sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role"`,
  },
  {
    label: 'add "applicants"."clerk_user_id" column',
    sql: `ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "clerk_user_id" varchar(255)`,
  },
];

async function main() {
  console.log("─".repeat(60));
  console.log("  Recrutva — Push Migration 0002");
  console.log("─".repeat(60));

  for (let i = 0; i < statements.length; i++) {
    const { label, sql: stmt } = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] ${label}...`);
    try {
      await sql.query(stmt);
      console.log("  ✓ Success");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already exists")) {
        console.log("  ⏭ Already exists — skipping");
      } else {
        console.error(`  ✗ Error: ${message}`);
        throw err;
      }
    }
  }

  // Verify the schema matches db/schema.ts
  console.log("\n" + "─".repeat(60));
  console.log("  Verifying schema...");
  console.log("─".repeat(60));

  const usersRole = await sql.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'`
  );
  const applicantsClerkUserId = await sql.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'applicants'
       AND column_name = 'clerk_user_id'`
  );
  const enumValues = await sql.query(
    `SELECT e.enumlabel FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'user_role'
     ORDER BY e.enumsortorder`
  );

  console.log(`\n  users.role:                 ${usersRole.length ? "✓" : "✗ MISSING"}`);
  console.log(`  applicants.clerk_user_id:   ${applicantsClerkUserId.length ? "✓" : "✗ MISSING"}`);
  console.log(
    `  user_role enum:             ${enumValues.length ? "✓ " + enumValues.map((r) => r.enumlabel).join(", ") : "✗ MISSING"}`
  );

  const ok =
    usersRole.length === 1 &&
    applicantsClerkUserId.length === 1 &&
    enumValues.length === 2;

  if (!ok) {
    console.error("\n✗ Schema is still incomplete. Check errors above.");
    process.exit(1);
  }

  console.log("\n✓ Migration 0002 applied. Onboarding can persist roles.");
}

main().catch((err) => {
  console.error("Push failed:", err);
  process.exit(1);
});
