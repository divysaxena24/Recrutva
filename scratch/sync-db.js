const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function fix() {
  try {
    console.log('Renaming jobId to targetJobId in DB...');
    // 1. Drop existing job_id column and sequence if they exist
    await sql.unsafe('ALTER TABLE "candidates" DROP COLUMN IF EXISTS "job_id" CASCADE');
    
    // 2. Add target_job_id column as a clean nullable integer
    await sql.unsafe('ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "target_job_id" integer');
    
    // 3. Add the foreign key constraint
    await sql.unsafe('ALTER TABLE "candidates" ADD CONSTRAINT "candidates_target_job_id_jobs_id_fk" FOREIGN KEY ("target_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL');
    
    console.log('Database synced successfully!');
  } catch (err) {
    console.error('Sync failed:', err.message);
  }
}

fix();
