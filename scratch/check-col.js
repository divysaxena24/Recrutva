const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function checkColumn() {
  try {
    const result = await sql`
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'candidates' AND column_name = 'job_id'
    `;
    console.log('Column Info:', result[0]);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkColumn();
