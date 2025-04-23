import express, { type Express, type Request, type Response } from "express";
import session from "express-session";
import { createServer, type Server } from "http";
import { generateArticleContent, generateArticleSummary, generateArticleChat, generateArticleVariants, analyzeArticle } from "./openai";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import axios from "axios";
import { db } from "./db";
import { eq, like } from "drizzle-orm";
import { articles } from "../shared/schema";
import { log } from "./vite";
import { CATEGORIES } from "./seed-articles";

/**
 * Utility function to decode HTML entities in text
 * Handles common entities like &quot;, &#039;, &amp;, etc.
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  const entities: Record<string, string> = {
    '&quot;': '"',
    '&apos;': "'",
    '&#039;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&nbsp;': ' '
  };

  // Replace all known entities
  let decodedText = text;
  for (const [entity, replacement] of Object.entries(entities)) {
    decodedText = decodedText.replace(new RegExp(entity, 'g'), replacement);
  }

  // Handle numeric entities like &#123;
  decodedText = decodedText.replace(/&#(\d+);/g, (_, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });

  return decodedText;
}

// Handle email verification from direct links
async function handleEmailVerification(req: Request, res: Response) {
  const token = req.query.token as string;

  if (!token) {
    return res.redirect('/verify-email?error=missing_token');
  }

  try {
    // Call the verifyEmail API directly to verify the token
    const user = await storage.verifyEmail(token);

    if (user) {
      // Successful verification - redirect to login page with success message
      return res.redirect('/login?verified=true');
    } else {
      // Failed verification - redirect to verification page with error
      return res.redirect('/verify-email?error=invalid_token');
    }
  } catch (error) {
    console.error("Error during email verification:", error);
    // Redirect to the verification page with error
    return res.redirect('/verify-email?error=verification_failed');
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Email verification redirect handler (for links in emails)
  app.get('/verify-email', handleEmailVerification);
  setupAuth(app);

  app.get("/api/ping", (_req, res) => {
    res.json({ message: "pong" });
  });

  // Generate article variants with AI
  app.post("/api/articles/variants", async (req, res) => {
    try {
      const { title, content } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required" });
      }

      const variants = await generateArticleVariants({
        title, 
        content
      });

      res.json(variants);
    } catch (error) {
      console.error("Error generating article variants:", error);
      res.status(500).json({ error: "Failed to generate article variants" });
    }
  });

  // Analyze article sentiment and themes
  app.post("/api/articles/analyze", async (req, res) => {
    try {
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const analysis = await analyzeArticle(content);

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing article:", error);
      res.status(500).json({ error: "Failed to analyze article" });
    }
  });

  // Chat with AI about article
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context } = req.body;

      if (!message || !context) {
        return res.status(400).json({ error: "Message and context are required" });
      }

      const response = await generateArticleChat(message, context);

      res.json({ response });
    } catch (error) {
      console.error("Error generating chat response:", error);
      res.status(500).json({ error: "Failed to generate chat response" });
    }
  });

  // Process news batch from Flask
  app.post("/api/news/batch", async (req, res) => {
    try {
      const newsData = req.body;
      const sourceApi = newsData.sourceApi || "unknown";
      const articles = newsData.articles || [];

      console.log(`Received ${articles.length} articles from ${sourceApi}`);

      if (!articles.length) {
        // Return a 200 status instead of 400 to avoid error logging
        // Just indicate there are no new articles to process
        return res.status(201).json({ 
          message: "No new articles to process", 
          articles: [] 
        });
      }

      const processedArticles = [];

      // Process and store each article
      for (const article of articles) {
        // Generate a unique ID for the article if not present
        const generated = await generateArticleContent({
          title: article.title,
          content: article.content || article.description || "",
          category: article.category || "general",
          country: article.country || "GLOBAL"
        });

        // Store in database
        const enhanced = await storage.createArticle({
          title: article.title,
          summary: article.description || "",
          sourceUrl: article.url || "",
          sourceApi,
          country: article.country || "GLOBAL",
          category: article.category || "general",
          originalContent: article.content || article.description || "",
          originalJson: article.originalJson || JSON.stringify(article),
          // createdAt is handled automatically by database default
          // aiEnhancedContent is set in the update call below
        });

        // Update with AI enhanced content
        await storage.updateArticle(enhanced.id, {
          aiEnhancedContent: generated.articleContent
        });

        processedArticles.push(enhanced);
      }

      res.status(201).json({ articles: processedArticles });
    } catch (error) {
      console.error("Error processing news batch:", error);
      res.status(400).json({ error: "Invalid news data format" });
    }
  });

  // Get articles with optional country filter - optimized for immediate response
  app.get("/api/articles", async (req, res) => {
    try {
      log(`GET /api/articles - params: ${JSON.stringify(req.query)}`, "express");
      const country = req.query.country as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 30;
      const fromDate = req.query.from as string | undefined;
      const toDate = req.query.to as string | undefined;

      // This endpoint should respond very quickly, so we use a timeout to ensure it returns
      // promptly even if there's an issue with the database query
      const timeoutPromise = new Promise<{articles: any[], totalCount: number}>((resolve) => {
        setTimeout(() => {
          log('Articles query timed out, returning empty array', 'express');
          resolve({articles: [], totalCount: 0});
        }, 10000); // 10 second timeout - increased to prevent timeout errors
      });

      // Create the database query promise
      const dbQueryPromise = (async () => {
        try {
          // Get articles from storage with pagination
          const result = await storage.getArticles({country, page, pageSize, fromDate, toDate});
          return result;
        } catch (error) {
          log(`Error querying articles: ${error}`, "express");
          return {articles: [], totalCount: 0};
        }
      })();

      // Race the database query against the timeout
      const result = await Promise.race([dbQueryPromise, timeoutPromise]);

      // Return articles with pagination metadata
      res.json({
        articles: result.articles.map(article => ({
          ...article,
          title: decodeHtmlEntities(article.title),
          summary: decodeHtmlEntities(article.summary),
          // Update Newsroom API country codes
          country: article.sourceApi === "Newsroom API" ? "GLOBAL" : article.country
        })),
        pagination: {
          page,
          pageSize,
          totalCount: result.totalCount,
          totalPages: Math.ceil(result.totalCount / pageSize)
        }
      });
    } catch (error) {
      log(`Error handling GET /api/articles: ${error}`, "express");
      // Instead of sending an error, return an empty array to prevent errors showing to the user
      res.json({
        articles: [],
        pagination: {
          page: 1,
          pageSize: 30,
          totalCount: 0,
          totalPages: 0
        }
      });
    }
  });

  // Get article by ID
  app.get("/api/articles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid article ID" });
      }

      const article = await storage.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      res.json(article);
    } catch (error) {
      console.error(`Error fetching article ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to fetch article" });
    }
  });

  // Summarize article content
  app.post("/api/summarize", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Missing article content" });
      }

      const summary = await generateArticleSummary(content);
      res.json({ summary });
    } catch (error) {
      console.error("Error summarizing article:", error);
      res.status(500).json({ error: "Failed to summarize article" });
    }
  });

  // This endpoint is duplicated above, removed to avoid conflicts

  // Generate article variants (social post, short form, etc.)
  app.post("/api/variants", async (req, res) => {
    try {
      const { title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: "Missing article title or content" });
      }

      const variants = await generateArticleVariants({ title, content });
      res.json(variants);
    } catch (error) {
      console.error("Error generating article variants:", error);
      res.status(500).json({ error: "Failed to generate article variants" });
    }
  });

  // Analyze article sentiment, objectivity, etc.
  app.post("/api/analyze", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Missing article content" });
      }

      const analysis = await analyzeArticle(content);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing article:", error);
      res.status(500).json({ error: "Failed to analyze article" });
    }
  });

  // Proxy endpoint to fetch news from Flask server
  app.get("/api/proxy-news", async (req, res) => {
    try {
      const queryParams = req.query;
      log(`Proxying fetch news request with params: ${JSON.stringify(queryParams)}`, "express");

      // First check for database articles
      const country = req.query.country as string | undefined;
      let dbArticles: any[] = [];

      try {
        // Get articles with pagination support
        const result = await storage.getArticles({ country });
        dbArticles = result.articles;

        // If search query, filter articles
        if (req.query.query) {
          const query = (req.query.query as string).toLowerCase();
          dbArticles = dbArticles.filter(a => 
            a.title.toLowerCase().includes(query) || 
            a.summary.toLowerCase().includes(query) ||
            (a.aiEnhancedContent?.toLowerCase().includes(query) || false)
          );
        }

        // Return available articles from database immediately
        log(`Found ${dbArticles.length} articles in database, returning immediately`, "express");

        // Prepare response with articles from database
        const response = {
          message: "Fetched articles from database",
          articles: dbArticles.map(article => ({
            title: article.title,
            description: article.summary,
            content: article.aiEnhancedContent,
            url: article.sourceUrl,
            publishedAt: new Date(article.createdAt).toISOString(),
            source: { name: article.sourceApi || "Database" },
            country: article.country,
            category: article.category
          }))
        };

        // Send immediate response with database articles
        res.json(response);

        // Initiate background fetch to collect more articles in the background
        // This won't affect the user experience since we've already sent the response
        log("Initiating background fetch to add more content to database", "express");

        // Perform background fetch from News API via Flask
        setTimeout(async () => {
          try {
            const backgroundFetchUrl = `http://localhost:5001/fetch-news`;
            let urlParams = new URLSearchParams();

            // Add query parameters to URL for Flask
            if (country) urlParams.append('country', country);
            if (req.query.query) urlParams.append('query', req.query.query as string);
            if (req.query.trending === 'true') urlParams.append('trending', 'true');

            const fullUrl = `${backgroundFetchUrl}?${urlParams.toString()}`;
            log(`Background fetch from: ${fullUrl}`, "express");

            const flaskResponse = await axios.get(fullUrl, { timeout: 30000 });

            if (flaskResponse.data && flaskResponse.data.articles && Array.isArray(flaskResponse.data.articles)) {
              const newsApiArticles = flaskResponse.data.articles;
              log(`Received ${newsApiArticles.length} new articles from News API in background`, "express");

              // Process and store each new article
              for (const article of newsApiArticles) {
                try {
                  // Check if article already exists by URL or similar title
                  const existingByUrl = article.url ? 
                    await storage.getArticleByUrl(article.url) : null;

                  if (existingByUrl) {
                    log(`Article with URL already exists: ${article.title}`, "express");
                    continue;
                  }

                  // Generate enhanced content with AI
                  log(`Enhancing new article with AI: ${article.title}`, "express");
                  const generated = await generateArticleContent({
                    title: article.title,
                    content: article.content || article.description || "",
                    category: article.category || "general",
                    country: article.country || country || "GLOBAL"
                  });

                  // Store in database
                  await storage.createArticle({
                    title: article.title,
                    summary: article.description || "",
                    sourceUrl: article.url || "",
                    sourceApi: "News API",
                    country: article.country || country || "GLOBAL",
                    category: article.category || "general",
                    originalContent: article.content || article.description || "",
                    originalJson: JSON.stringify(article)
                  });

                  log(`Successfully added new article to database: ${article.title}`, "express");
                } catch (articleError) {
                  log(`Error processing background article: ${articleError}`, "express");
                }
              }

              log(`Background fetch completed, added new content to database`, "express");
            }
          } catch (backgroundError) {
            log(`Background fetch error: ${backgroundError}`, "express");
          }
        }, 100); // Very short delay to ensure the response is sent first
      } catch (error: any) {
        log(`Error fetching from database: ${error.message}`, "express");
        // Return an empty array instead of an error to avoid showing errors to the user
        return res.json({
          message: "No articles found",
          articles: []
        });
      }
    } catch (error: any) {
      log(`Error proxying fetch news request: ${error.message}`, "express");

      // Always return success with empty array instead of an error
      // This prevents error messages from showing up to the user
      res.json({ 
        message: "No articles found", 
        articles: [] 
      });
    }
  });

  // Proxy endpoint for the Newsroom API
  app.get("/api/proxy-newsroom", async (req, res) => {
    try {
      log(`Proxying request to Newsroom API`, "express");

      // First check for existing Newsroom articles in the database
      try {
        log("Checking for Newsroom articles in database first", "express");

        // Query articles specifically from the Newsroom API source
        const newsroomArticles = await db
          .select()
          .from(articles)
          .where(eq(articles.sourceApi, "Newsroom API"))
          .limit(20);

        if (newsroomArticles.length > 0) {
          log(`Found ${newsroomArticles.length} Newsroom articles in database, returning immediately`, "express");

          // Return available Newsroom articles from database
          res.json({
            message: "Fetched Newsroom articles from database",
            articles: newsroomArticles.map(article => ({
              title: decodeHtmlEntities(article.title),
              description: decodeHtmlEntities(article.summary),
              content: article.aiEnhancedContent,
              url: article.sourceUrl,
              publishedAt: new Date(article.createdAt).toISOString(),
              source: { name: "Newsroom API" },
              country: "GLOBAL", // Always use GLOBAL for Newsroom API
              category: article.category
            }))
          });

          // No background fetching for Newsroom API
          log("Background Newsroom article fetching is disabled", "express");

          return; // End the request here since we've already responded
        } else {
          log("No Newsroom articles found in database, trying to fetch new ones", "express");
        }
      } catch (dbError: any) {
        log(`Error checking database for Newsroom articles: ${dbError.message}`, "express");
        // Continue with Flask API call if DB query fails
      }

      // If no articles in database, forward the request to Flask
            // First check if Flask server is responsive
      const healthCheckUrl = 'http://localhost:5001/';
      try {
        const healthCheck = await axios.get(healthCheckUrl, { timeout: 5000 });
        log(`Flask server health check: ${healthCheck.data?.status || 'unknown'}`, "express");
      } catch (error: any) {
        log(`Flask server health check failed: ${error.message}`, "express");
        throw new Error('Flask server not available for Newsroom API');
      }

      const flaskUrl = `http://localhost:5001/fetch-newsroom`;
      const response = await axios.get(flaskUrl, { 
        timeout: 60000 // 60 second timeout
      });

      // Process the response data to store in database
      const newsData = response.data;

      // If we have articles, try to store them in the database in the background
      if (newsData && newsData.articles && Array.isArray(newsData.articles)) {
        try {
          log(`Storing ${newsData.articles.length} articles from Newsroom API in database`, "express");

          // Store all articles from the API
          for (const rawArticle of newsData.articles) {
            try {
              const title = rawArticle.title || "Untitled Article";

              // Check if article already exists in database by URL
              let existingArticle: any | undefined;
              if (rawArticle.url) {
                const existingArticles = await db
                  .select()
                  .from(articles)
                  .where(eq(articles.sourceUrl, rawArticle.url));

                if (existingArticles.length > 0) {
                  log(`Newsroom article with URL already exists: ${title}`, "express");
                  continue;
                }
              } else {
                // Look for similar titles to avoid duplicates without URLs
                const existingArticles = await db
                  .select()
                  .from(articles)
                  .where(eq(articles.title, title));

                if (existingArticles.length > 0) {
                  log(`Newsroom article with similar title already exists: ${title}`, "express");
                  continue;
                }
              }

              // Decode HTML entities in title
              const decodedTitle = decodeHtmlEntities(title);
              log(`Creating new article from Newsroom in database: ${decodedTitle}`, "express");

              // For articles without content, use description
              const rawContent = rawArticle.content || rawArticle.description || "Article content unavailable";
              const content = decodeHtmlEntities(rawContent);

              // Create a new article in the database
              const newArticle = await storage.createArticle({
                title: decodedTitle,
                originalContent: decodeHtmlEntities(rawArticle.description || content || "No original content"),
                summary: decodeHtmlEntities(rawArticle.description || "No summary available"),
                country: "GLOBAL",  // Use GLOBAL instead of country code for Newsroom API articles
                category: rawArticle.category || "general",
                sourceUrl: rawArticle.url || null,
                sourceApi: "Newsroom API",
                originalJson: JSON.stringify(rawArticle),
                authorId: 1, // Use our admin user ID
              });

              log(`Newsroom article created with ID ${newArticle.id}, enhancing content with AI`, "express");

              // Enhance content with AI for all Newsroom articles
              try {
                log(`Enhancing Newsroom article content with AI for: ${decodedTitle}`, "express");
                const generated = await generateArticleContent({
                  title: decodedTitle,
                  content: JSON.stringify(rawArticle),
                  category: rawArticle.category || "general",
                  country: "GLOBAL" // Use GLOBAL instead of country code for Newsroom
                });

                // Update with AI enhanced content
                await storage.updateArticle(newArticle.id, {
                  aiEnhancedContent: generated.articleContent
                });

                log(`Successfully enhanced Newsroom article with AI: ${decodedTitle}`, "express");
              } catch (aiError: any) {
                log(`Error enhancing Newsroom article with AI: ${aiError.message}`, "express");
                // If AI enhancement fails, use the original content
                await storage.updateArticle(newArticle.id, {
                  aiEnhancedContent: content
                });
              }

              log(`Successfully stored Newsroom article: ${decodedTitle}`, "express");
            } catch (error: any) {
              log(`Error storing Newsroom article: ${error.message}`, "express");

              // Don't log full article data as it can be huge
              const articleSummary = {
                title: rawArticle.title,
                source: rawArticle.source?.name,
                url: rawArticle.url
              };
              log(`Failed Newsroom article: ${JSON.stringify(articleSummary)}`, "express");
            }
          }
        } catch (error: any) {
          log(`Error initiating Newsroom article storage: ${error.message}`, "express");
        }
      }

      // Format the response with a message
      const responseData = {
        ...newsData,
        message: "Fetched from Newsroom API and storing in database. Articles may take time to process."
      };

      // Return the data and continue storing in the background
      return res.json(responseData);
    } catch (error: any) {
      log(`Error proxying Newsroom API request: ${error.message}`, "express");

      // Create fallback response with Newsroom-specific database articles if available
      try {
        log("Fetching Newsroom articles from database as fallback", "express");

        // Query articles specifically from the Newsroom API source
        const newsroomArticles = await db
          .select()
          .from(articles)
          .where(eq(articles.sourceApi, "Newsroom API"))
          .limit(20);

        if (newsroomArticles.length > 0) {
          return res.json({
            message: "Fetched Newsroom articles from database as fallback",
            articles: newsroomArticles.map(article => ({
              title: decodeHtmlEntities(article.title),
              description: decodeHtmlEntities(article.summary),
              content: article.aiEnhancedContent,
              url: article.sourceUrl,
              publishedAt: new Date(article.createdAt).toISOString(),
              source: { name: "Newsroom API" },
              country: "GLOBAL", // Always use GLOBAL for Newsroom articles
              category: article.category
            }))
          });
        } else {
          log("No Newsroom articles found in database", "express");
        }
      } catch (fallbackError: any) {
        log(`Error fetching Newsroom articles from database: ${fallbackError.message}`, "express");
      }

      // Instead of returning an error, just return an empty article list
      // This prevents error messages from showing up to the user
      res.json({ 
        message: "No articles found", 
        articles: [] 
      });
    }
  });

  // Add endpoint to get categories
  app.get("/api/categories", (req, res) => {
    res.json({ categories: CATEGORIES });
  });

  const httpServer = createServer(app);
  return httpServer;
}