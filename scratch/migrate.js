const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    const sqlFile = path.join(__dirname, '..', 'drizzle', '0000_purple_colonel_america.sql');
    const content = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by --> statement-breakpoint
    const statements = content.split('--> statement-breakpoint');
    
    for (const statement of statements) {
      if (statement.trim()) {
        const cleanStatement = statement.trim();
        console.log('Executing:', cleanStatement.substring(0, 50) + '...');
        // @neondatabase/serverless uses raw queries for this
        await sql.unsafe(cleanStatement);
      }
    }
    
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrate();
