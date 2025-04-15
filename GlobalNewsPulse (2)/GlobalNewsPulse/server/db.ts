import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

// Create postgres connection
const client = postgres(process.env.DATABASE_URL!);

// Create drizzle instance
export const db = drizzle(client, { schema });

// Function to ping the database and ensure connection is working
export async function pingDatabase() {
  try {
    // Execute a simple query to check if the DB connection is working
    const result = await client`SELECT 1 as ping`;
    console.log('Database connection successful:', result);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}