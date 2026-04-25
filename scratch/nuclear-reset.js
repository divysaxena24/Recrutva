const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function nuclear() {
  try {
    console.log('DROPPING EVERYTHING...');
    await sql.unsafe('DROP TABLE IF EXISTS "candidates" CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS "jobs" CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS "users" CASCADE');
    
    console.log('RECREATING TABLES WITH CLEAN NAMES...');
    
    await sql.unsafe(`
      CREATE TABLE "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "clerk_id" varchar(255) NOT NULL UNIQUE,
        "name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await sql.unsafe(`
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

    await sql.unsafe(`
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
    
    console.log('Database nuclear reset successful!');
  } catch (err) {
    console.error('Nuclear reset failed:', err.message);
  }
}

nuclear();
