const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    console.log('Creating table...');
    await sql.unsafe('CREATE TABLE IF NOT EXISTS test_table (id serial PRIMARY KEY, name text)');
    console.log('Inserting data...');
    await sql.unsafe("INSERT INTO test_table (name) VALUES ('test')");
    console.log('Querying data...');
    const result = await sql`SELECT * FROM test_table`;
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
