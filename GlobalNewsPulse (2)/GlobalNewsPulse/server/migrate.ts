import { db } from "./db";
import { log } from "./vite";
import { users, articles, comments } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function runMigration() {
  log("Starting database migration...", "migrate");
  
  try {
    if (!process.env.DATABASE_URL) {
      log("No DATABASE_URL environment variable found. Skipping migration.", "migrate");
      return;
    }
    
    // Connect to the database using a separate client for migration
    const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });
    const migrationDb = drizzle(migrationClient);
    
    log("Creating tables if they don't exist...", "migrate");
    
    // Create the users table
    await migrationDb.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255) NOT NULL,
        is_editor BOOLEAN NOT NULL DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        verification_token TEXT,
        verification_token_expiry TIMESTAMP WITH TIME ZONE,
        reset_password_token TEXT,
        reset_password_token_expiry TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create the articles table
    await migrationDb.execute(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        original_content TEXT NOT NULL,
        summary TEXT NOT NULL,
        ai_enhanced_content TEXT,
        country VARCHAR(10) NOT NULL,
        category VARCHAR(50) NOT NULL,
        source_url TEXT,
        source_api VARCHAR(50),
        original_json TEXT,
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create the comments table
    await migrationDb.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        is_explainer BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);
    
    // Create index for faster country-based article searching
    await migrationDb.execute(`
      CREATE INDEX IF NOT EXISTS idx_articles_country ON articles(country);
    `);
    
    // Create index for faster category-based article searching
    await migrationDb.execute(`
      CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
    `);
    
    // Create basic index for faster article title searching
    await migrationDb.execute(`
      CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title);
    `);
    
    // Check if we have the admin user, create if not
    const adminResult = await migrationDb.execute(`
      SELECT * FROM users WHERE username = 'admin' LIMIT 1;
    `);
    
    if (!adminResult.length) {
      log("Creating admin user...", "migrate");
      await migrationDb.execute(`
        INSERT INTO users (username, email, password, is_editor, is_verified) 
        VALUES ('admin', 'admin@newsfeed.com', 'admin123', true, true);
      `);
    }
    
    // Check and add columns if they don't exist to handle existing database
    await migrationDb.execute(`
      -- Add email column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
          ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;
        END IF;
      END $$;
      
      -- Add is_verified column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_verified') THEN
          ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
      
      -- Add verification_token column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verification_token') THEN
          ALTER TABLE users ADD COLUMN verification_token TEXT;
        END IF;
      END $$;
      
      -- Add verification_token_expiry column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verification_token_expiry') THEN
          ALTER TABLE users ADD COLUMN verification_token_expiry TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
      
      -- Add reset_password_token column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_password_token') THEN
          ALTER TABLE users ADD COLUMN reset_password_token TEXT;
        END IF;
      END $$;
      
      -- Add reset_password_token_expiry column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_password_token_expiry') THEN
          ALTER TABLE users ADD COLUMN reset_password_token_expiry TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
      
      -- Add created_at column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
          ALTER TABLE users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
      END $$;
      
      -- Update existing admin user if email is null
      UPDATE users 
      SET email = 'admin@newsfeed.com', is_verified = true 
      WHERE username = 'admin' AND email IS NULL;
    `);
    
    // Close the migration client
    await migrationClient.end();
    
    log("Migration completed successfully!", "migrate");
  } catch (error: any) {
    log(`Migration failed: ${error.message}`, "migrate");
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, "migrate");
    }
    
    // Rethrow to signal failure to the calling process
    throw error;
  }
}

// If this file is run directly (e.g., via node migrate.js)
if (typeof process !== 'undefined' && process.argv[1].includes('migrate')) {
  runMigration()
    .then(() => {
      console.log("Migration completed successfully.");
      process.exit(0);
    })
    .catch(error => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

// Export for use in other files
export { runMigration as migrate };