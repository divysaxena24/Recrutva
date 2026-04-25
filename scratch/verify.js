const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function test() {
  try {
    const result = await sql`SELECT count(*) FROM candidates`;
    console.log('Candidates count:', result[0].count);
  } catch (err) {
    console.error('Error querying candidates:', err.message);
  }
}

test();
