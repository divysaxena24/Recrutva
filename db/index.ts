import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// We use the same DATABASE_URL stored in the .env file
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
