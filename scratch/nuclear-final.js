const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function run(label, query) {
  try {
    console.log(`Running: ${label}`);
    await sql.unsafe(query);
    console.log(`Success: ${label}`);
  } catch (err) {
    console.error(`Failed: ${label} - ${err.message}`);
  }
}

async function nuclear() {
  await run('Drop Applicants', 'DROP TABLE IF EXISTS applicants CASCADE');
  await run('Drop Candidates', 'DROP TABLE IF EXISTS candidates CASCADE');
  await run('Drop Jobs', 'DROP TABLE IF EXISTS jobs CASCADE');
  await run('Drop Users', 'DROP TABLE IF EXISTS users CASCADE');
  
  await run('Create Users', 'CREATE TABLE users (id serial PRIMARY KEY, clerk_id varchar(255) NOT NULL UNIQUE, name text NOT NULL, email text NOT NULL UNIQUE, created_at timestamp DEFAULT now() NOT NULL)');
  await run('Create Jobs', 'CREATE TABLE jobs (id serial PRIMARY KEY, user_id varchar(255) NOT NULL, title text NOT NULL, description text NOT NULL, requirements text, location text DEFAULT \'Remote\', status varchar(50) DEFAULT \'Open\' NOT NULL, created_at timestamp DEFAULT now() NOT NULL)');
  await run('Create Applicants', `
    CREATE TABLE applicants (
      id serial PRIMARY KEY,
      user_id varchar(255) NOT NULL,
      target_job_id integer REFERENCES jobs(id) ON DELETE SET NULL,
      job_title text,
      name text NOT NULL,
      email text NOT NULL,
      phone text NOT NULL,
      resume_text text,
      status varchar(50) DEFAULT 'Ready' NOT NULL,
      score text,
      match_score text,
      transcript text,
      summary text,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `);
}

nuclear();
