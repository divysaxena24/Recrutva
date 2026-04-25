const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function nuclear() {
  try {
    console.log('Dropping existing tables...');
    await sql.unsafe('DROP TABLE IF EXISTS candidates CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS applicants CASCADE');
    
    console.log('Creating applicants table...');
    await sql.unsafe(`
      CREATE TABLE applicants (
        id serial PRIMARY KEY,
        user_id varchar(255) NOT NULL,
        target_job_id integer,
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
        scheduled_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    
    console.log('Success! Table applicants created.');
    
    const res = await sql.unsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Current tables:', res);
  } catch (err) {
    console.error('Nuclear reset failed:', err);
  }
}

nuclear();
