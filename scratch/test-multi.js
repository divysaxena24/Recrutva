const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const multiQuery = `
      CREATE TABLE IF NOT EXISTS test_table_2 (id serial PRIMARY KEY, name text);
      INSERT INTO test_table_2 (name) VALUES ('test');
      SELECT * FROM test_table_2;
    `;
    console.log('Executing multi-query...');
    const result = await sql.unsafe(multiQuery);
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
