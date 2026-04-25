const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function checkCols() {
  try {
    const result = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'candidates'
    `;
    console.log('Columns:', result.map(r => r.column_name));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkCols();
