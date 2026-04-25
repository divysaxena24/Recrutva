const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function updateSequence() {
  try {
    // Set the starting value of the jobs id sequence to 1001
    await sql`ALTER SEQUENCE jobs_id_seq RESTART WITH 1001`;
    console.log('Sequence jobs_id_seq updated to start at 1001');
    
    // Also update existing jobs if any to have 4-digit IDs (optional but good for consistency)
    // Actually, it's safer to just let new ones be 1001+
  } catch (err) {
    console.error('Failed to update sequence:', err);
  }
}

updateSequence();
