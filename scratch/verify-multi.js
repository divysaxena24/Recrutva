const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const result = await sql`SELECT * FROM test_table_2`;
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
