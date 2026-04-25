const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    const sqlFile = path.join(__dirname, '..', 'drizzle', '0000_purple_colonel_america.sql');
    const content = fs.readFileSync(sqlFile, 'utf8');
    
    // Remove comments and statement breakpoints
    const statements = content.split('--> statement-breakpoint');
    
    for (let statement of statements) {
      statement = statement.trim();
      if (statement) {
        console.log('Executing statement...');
        await client.query(statement);
      }
    }
    
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
