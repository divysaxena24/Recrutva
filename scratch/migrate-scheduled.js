const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log('Adding scheduled_at column...');
    await sql.unsafe('ALTER TABLE applicants ADD COLUMN IF NOT EXISTS scheduled_at timestamp');
    console.log('Success!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

migrate();
