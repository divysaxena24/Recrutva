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

    await client.query('DROP TABLE IF EXISTS "candidates" CASCADE');
    await client.query('DROP TABLE IF EXISTS "jobs" CASCADE');
    await client.query('DROP TABLE IF EXISTS "users" CASCADE');
    
    await client.query(`
      CREATE TABLE "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "clerk_id" varchar(255) NOT NULL UNIQUE,
        "name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE "jobs" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar(255) NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "requirements" text,
        "location" text DEFAULT 'Remote',
        "status" varchar(50) DEFAULT 'Open' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE "candidates" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar(255) NOT NULL,
        "target_job_id" integer REFERENCES "jobs"("id") ON DELETE SET NULL,
        "job_title" text,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "phone" text NOT NULL,
        "resume_text" text,
        "status" varchar(50) DEFAULT 'Ready' NOT NULL,
        "score" text,
        "match_score" text,
        "transcript" text,
        "summary" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    console.log('Verifying...');
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'candidates'
    `);
    console.log('Columns:', result.rows.map(r => r.column_name));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

fix();
