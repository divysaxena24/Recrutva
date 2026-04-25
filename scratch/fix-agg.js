const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function fix() {
  try {
    console.log('Aggressively fixing candidates table...');
    // 1. Drop the column if it exists
    await sql.unsafe('ALTER TABLE "candidates" DROP COLUMN IF EXISTS "job_id" CASCADE');
    
    // 2. Add it back as a nullable integer without any default
    await sql.unsafe('ALTER TABLE "candidates" ADD COLUMN "job_id" integer');
    
    // 3. Add the foreign key constraint
    await sql.unsafe('ALTER TABLE "candidates" ADD CONSTRAINT "candidates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL');
    
    console.log('Final verification...');
    const result = await sql`
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'candidates' AND column_name = 'job_id'
    `;
    console.log('New Column Info:', result[0]);
    console.log('Fix complete!');
  } catch (err) {
    console.error('Fix failed:', err.message);
  }
}

fix();
