const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  try {
    console.log("Adding analysis column to applicants table...");
    await sql`ALTER TABLE applicants ADD COLUMN IF NOT EXISTS analysis JSONB;`;
    console.log("Migration successful.");
  } catch (err) {

    console.error("Migration error:", err);
  }
}

run();
