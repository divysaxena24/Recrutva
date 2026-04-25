const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const multi = `
      ALTER TABLE "candidates" DROP COLUMN IF EXISTS "job_id" CASCADE;
      ALTER TABLE "candidates" ADD COLUMN "job_id" integer NULL;
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'candidates' AND column_name = 'job_id';
    `;
    console.log('Executing multi...');
    const result = await sql.query(multi);
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
