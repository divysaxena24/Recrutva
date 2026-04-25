const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  try {
    console.log('Current DB:', process.env.DATABASE_URL);
    
    // Check tables before
    const before = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log('Tables before:', before.map(t => t.table_name));

    console.log('Dropping candidates...');
    await sql`DROP TABLE IF EXISTS candidates CASCADE`;
    
    console.log('Creating applicants...');
    await sql`
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
    `;

    // Check tables after
    const after = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log('Tables after:', after.map(t => t.table_name));

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
