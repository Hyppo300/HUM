import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pingDatabase } from "./db";
import * as path from "path";
import { exec } from "child_process";
import { seedArticles } from "./seed-articles";
import { registerAuthRoutes } from "./auth-routes";
import { setupAuth } from "./auth";
import * as dotenv from "dotenv";
import { startBackgroundFetching } from "./background-fetch";

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database if using PostgreSQL
  if (process.env.DATABASE_URL) {
    log('Checking database connection...');
    try {
      const connected = await pingDatabase();
      if (connected) {
        log('Database connection successful');
        
        // Run the migration directly
        log('Running database migration...');
        
        try {
          // Import the migration function directly
          const { migrate } = await import('./migrate');
          
          try {
            // Run migration
            await migrate();
            log('Migration completed successfully');
            
            // Disable article seeding for faster startup (placeholder articles added to MemStorage)
            log('Article seeding disabled for faster startup, using placeholder articles instead.');
            
            // We'll run article seeding in the background after server starts
            setTimeout(() => {
              log('Starting background article seeding...');
              seedArticles()
                .then(() => log('Background article seeding completed'))
                .catch(err => log(`Background article seeding error: ${err.message}`));
            }, 5000);
          } catch (migrationError: any) {
            log(`Migration failed: ${migrationError.message}`);
          }
        } catch (importError: any) {
          log(`Error importing migration module: ${importError.message}`);
        }
      } else {
        log('Database connection failed. Check your DATABASE_URL environment variable.');
      }
    } catch (error: any) {
      log(`Database initialization error: ${error.message}`);
    }
  }
  
  // Set up auth middleware and session management
  setupAuth(app);

  // Register authentication routes
  registerAuthRoutes(app);
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start the background news fetching service
    log("Initializing background news fetching service");
    setTimeout(() => {
      try {
        startBackgroundFetching();
        log("Background news fetching service started successfully");
      } catch (error) {
        log(`Failed to start background news fetching: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 5000); // Wait 5 seconds to ensure Flask server is fully operational
  });
})();
