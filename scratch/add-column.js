const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function addColumn() {
  try {
    console.log("Attempting to add 'last_notified_at' column...");
    await sql`ALTER TABLE applicants ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP;`;
    console.log("Column added successfully or already exists.");
  } catch (err) {
    console.error("Error adding column:", err);
  }
}

addColumn();
