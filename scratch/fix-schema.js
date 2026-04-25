const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function fix() {
  try {
    console.log('Fixing candidates table...');
    // Drop the problematic job_id column and recreate it as a nullable integer
    await sql.unsafe('ALTER TABLE "candidates" DROP COLUMN IF EXISTS "job_id"');
    await sql.unsafe('ALTER TABLE "candidates" ADD COLUMN "job_id" integer REFERENCES "jobs"("id")');
    console.log('Table fixed successfully!');
  } catch (err) {
    console.error('Fix failed:', err.message);
  }
}

fix();
