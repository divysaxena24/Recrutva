const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function fix() {
  try {
    console.log('Renaming candidates to applicants...');
    await sql.unsafe('ALTER TABLE IF EXISTS candidates RENAME TO applicants');
    
    console.log('Adding missing columns to applicants...');
    await sql.unsafe('ALTER TABLE applicants ADD COLUMN IF NOT EXISTS scheduled_at timestamp');
    await sql.unsafe('ALTER TABLE applicants ADD COLUMN IF NOT EXISTS job_title text');
    
    console.log('Success! Table applicants is ready.');
    
    const tables = await sql.unsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables now:', tables);
  } catch (err) {
    console.error('Fix failed:', err);
  }
}

fix();
