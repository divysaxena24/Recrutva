const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const res = await sql`SELECT id, name, target_job_id, job_title FROM applicants`;
    console.log('Applicants Data:', res);
    
    const jobs = await sql`SELECT id, title FROM jobs`;
    console.log('Jobs Data:', jobs);
  } catch (err) {
    console.error('Check failed:', err);
  }
}

check();
