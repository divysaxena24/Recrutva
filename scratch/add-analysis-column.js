const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
});

async function run() {
  try {
    console.log("Adding analysis column to applicants table...");
    await pool.query('ALTER TABLE applicants ADD COLUMN IF NOT EXISTS analysis JSONB;');
    console.log("Migration successful.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    pool.end();
  }
}

run();
