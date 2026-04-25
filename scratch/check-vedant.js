const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  try {
    const candidates = await sql`SELECT id, name, status, transcript, analysis FROM applicants WHERE name = 'Vedant Singh'`;
    console.log(JSON.stringify(candidates, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
