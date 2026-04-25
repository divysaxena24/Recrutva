const { Client } = require('pg');
require('dotenv').config();

async function fix() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected');

    console.log('Dropping column...');
    await client.query('ALTER TABLE "candidates" DROP COLUMN IF EXISTS "job_id" CASCADE');
    
    console.log('Adding column...');
    await client.query('ALTER TABLE "candidates" ADD COLUMN "job_id" integer NULL');
    
    console.log('Verifying...');
    const result = await client.query(`
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'candidates' AND column_name = 'job_id'
    `);
    console.log('Info:', result.rows[0]);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

fix();
