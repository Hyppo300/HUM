import axios from 'axios';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { storage } from './storage';
import { articles } from '@shared/schema';
import { log } from './vite';
import { 
  generateArticleContent, 
  generateArticleVariants,
  analyzeArticle
} from "./openai";

// Categories to fetch news for
const CATEGORIES = [
  'business',
  'entertainment',
  'general',
  'health',
  'science',
  'sports',
  'technology'
];

// Countries to fetch news for
const COUNTRIES = [
  'us',   // United States
  'gb',   // United Kingdom
  'ca',   // Canada
  'au',   // Australia
  'in',   // India
  'jp',   // Japan
  'de',   // Germany
  'fr',   // France
  'br',   // Brazil
  'mx'    // Mexico
];

// Trending topics to search for
const TRENDING_TOPICS = [
  'climate change',
  'artificial intelligence',
  'cryptocurrency',
  'global economy',
  'space exploration',
  'renewable energy',
  'quantum computing',
  'vaccination',
  'cyber security',
  'political elections'
];

/**
 * Main function to seed the database with articles
 */
export async function seedArticles() {
  log('Starting to seed database with articles...', 'article-seeder');
  
  try {
    const count = await getArticleCount();
    log(`Current article count in database: ${count}`, 'article-seeder');
    
    // Always seed at least some articles, but limit based on current count
    // This ensures we always get new articles on server restart
    let categories = CATEGORIES;
    let countries = COUNTRIES;
    let trending = TRENDING_TOPICS;
    
    // Adjust how many sources we pull from based on current database size
    if (count > 200) {
      // For very large databases, just get a few fresh articles
      log('Large article database detected, fetching minimal fresh content...', 'article-seeder');
      categories = ['general'];
      countries = ['us'];
      trending = ['latest news'];
    } else if (count > 100) {
      // For medium databases, get a reasonable amount
      log('Medium article database detected, fetching moderate fresh content...', 'article-seeder');
      categories = ['general', 'business', 'technology'];
      countries = ['us', 'gb', 'ca'];
      trending = trending.slice(0, 3);
    }
    
    // Generate articles
    await generateCategoryBasedArticles(categories);
    await generateCountryBasedArticles(countries); 
    await generateTrendingArticles(trending);
    
    const newCount = await getArticleCount();
    log(`Seeding complete! Article count: ${newCount}`, 'article-seeder');
  } catch (error: any) {
    log(`Error during article seeding: ${error.message}`, 'article-seeder');
  }
}

/**
 * Get the current count of articles in the database
 */
async function getArticleCount(): Promise<number> {
  const result = await db.select().from(articles);
  return result.length;
}

/**
 * Generate articles for each news category
 */
async function generateCategoryBasedArticles(categoriesToUse: string[] = CATEGORIES) {
  for (const category of categoriesToUse) {
    try {
      log(`Fetching category news for: ${category}`, 'article-seeder');
      const response = await fetchNewsFromFlask({ category, page_size: 5 });
      
      if (response && response.articles && Array.isArray(response.articles)) {
        await processAndStoreArticles(response.articles, category, 'US');
      }
    } catch (error: any) {
      log(`Error fetching ${category} news: ${error.message}`, 'article-seeder');
    }
  }
}

/**
 * Generate articles for each country
 */
async function generateCountryBasedArticles(countriesToUse: string[] = COUNTRIES) {
  for (const country of countriesToUse) {
    try {
      log(`Fetching country news for: ${country}`, 'article-seeder');
      const response = await fetchNewsFromFlask({ country, page_size: 3 });
      
      if (response && response.articles && Array.isArray(response.articles)) {
        await processAndStoreArticles(response.articles, 'general', country.toUpperCase());
      }
    } catch (error: any) {
      log(`Error fetching news for ${country}: ${error.message}`, 'article-seeder');
    }
  }
}

/**
 * Generate articles for trending topics
 */
async function generateTrendingArticles(topicsToUse: string[] = TRENDING_TOPICS) {
  for (const topic of topicsToUse) {
    try {
      log(`Fetching trending news for: ${topic}`, 'article-seeder');
      const response = await fetchNewsFromFlask({ query: topic, page_size: 2 });
      
      if (response && response.articles && Array.isArray(response.articles)) {
        await processAndStoreArticles(response.articles, 'trending', 'GLOBAL', topic);
      }
    } catch (error: any) {
      log(`Error fetching trending news for ${topic}: ${error.message}`, 'article-seeder');
    }
  }
}

/**
 * Fetch news from the Flask server
 */
async function fetchNewsFromFlask(params: any): Promise<any> {
  const flaskUrl = "http://localhost:5001/fetch-news";
  try {
    const response = await axios.get(flaskUrl, { 
      params,
      timeout: 30000 // 30 second timeout
    });
    return response.data;
  } catch (error: any) {
    log(`Error fetching from Flask: ${error.message}`, 'article-seeder');
    return null;
  }
}

/**
 * Process and store articles with AI enhancements
 */
async function processAndStoreArticles(
  rawArticles: any[], 
  category: string, 
  country: string,
  topic?: string
) {
  for (const rawArticle of rawArticles) {
    try {
      const title = rawArticle.title || `News about ${topic || category}`;
      
      // Even if there's no content, we'll try to generate it with AI
      // so we no longer skip articles without content
      
      // Check if article already exists in database by URL or similar title
      let existingArticle = false;
      if (rawArticle.url) {
        const existing = await storage.getArticleByUrl(rawArticle.url);
        if (existing) {
          log(`Article with URL already exists: ${title}`, 'article-seeder');
          existingArticle = true;
        }
      }
      
      // If URL check doesn't find a match, check for similar titles
      if (!existingArticle) {
        // Look for similar titles to avoid duplicates without URLs
        const existingArticles = await db
          .select()
          .from(articles)
          .where(eq(articles.title, title));
        
        if (existingArticles.length > 0) {
          log(`Article with similar title already exists: ${title}`, 'article-seeder');
          existingArticle = true;
        }
      }
      
      // Skip if the article exists
      if (existingArticle) {
        continue;
      }
      
      log(`Processing article: ${title}`, 'article-seeder');
      
      // Generate enhanced content with OpenAI
      try {
        const generated = await generateArticleContent({
          title: title,
          content: JSON.stringify(rawArticle),
          category,
          country
        });
        
        // Optional enhancements that shouldn't block article storage
        let variants = {
          socialPost: '',
          shortForm: '',
          newsChannel: ''
        };
        
        // Creating proper analysis object with correct types
        let analysis: {
          sentiment: string,
          objectivity: number,
          keyThemes: string[],
          potentialBias: string
        } = {
          sentiment: 'neutral',
          objectivity: 0.5,
          keyThemes: [],
          potentialBias: 'unknown'
        };
        
        // Try to generate variants, but don't let it block article storage
        try {
          const variantResult = await generateArticleVariants({
            title: generated.enhancedTitle,
            content: generated.articleContent
          });
          
          if (variantResult) {
            variants = variantResult;
          }
        } catch (variantError: any) {
          log(`Error generating variants: ${variantError.message}`, 'article-seeder');
        }
        
        // Try to analyze sentiment, but don't let it block article storage
        try {
          const analysisResult = await analyzeArticle(generated.articleContent);
          
          if (analysisResult) {
            analysis = analysisResult;
          }
        } catch (analysisError: any) {
          log(`Error analyzing article: ${analysisError.message}`, 'article-seeder');
        }
        
        // Store the article with its enhanced content
        const newArticle = await storage.createArticle({
          title: generated.enhancedTitle,
          originalContent: JSON.stringify(rawArticle),
          summary: generated.summary,
          country: country,
          category: category,
          sourceUrl: rawArticle.url || null,
          sourceApi: "NewsAPI",
          originalJson: JSON.stringify({
            raw: rawArticle,
            variants,
            analysis
          }),
          authorId: 1, // Use our admin user
        });
        
        // Update with AI enhanced content
        await storage.updateArticle(newArticle.id, {
          aiEnhancedContent: generated.articleContent
        });
        
        log(`Successfully stored AI-enhanced article: ${generated.enhancedTitle}`, 'article-seeder');
      } catch (aiError: any) {
        log(`Error generating AI content: ${aiError.message}`, 'article-seeder');
        
        // If AI enhancement fails, still store the original article with minimal processing
        try {
          // Clean up content if it exists
          const content = rawArticle.content || rawArticle.description || "Article content unavailable";
          const cleanContent = content.replace(/\[\+\d+ chars\]$/, '').trim();
          
          // Store a basic version of the article without AI enhancements
          const basicArticle = await storage.createArticle({
            title: title,
            originalContent: JSON.stringify(rawArticle),
            summary: rawArticle.description || "No summary available",
            country: country,
            category: category,
            sourceUrl: rawArticle.url || null,
            sourceApi: "NewsAPI",
            originalJson: JSON.stringify(rawArticle),
            authorId: 1, // Use our admin user
          });
          
          // Set the content directly
          await storage.updateArticle(basicArticle.id, {
            aiEnhancedContent: cleanContent
          });
          
          log(`Stored basic article without AI enhancement: ${title}`, 'article-seeder');
        } catch (basicError: any) {
          log(`Failed to store basic article: ${basicError.message}`, 'article-seeder');
        }
      }
    } catch (error: any) {
      log(`Error processing article: ${error.message}`, 'article-seeder');
      
      // Don't log full article data as it can be huge
      const articleSummary = {
        title: rawArticle.title,
        source: rawArticle.source?.name,
        url: rawArticle.url
      };
      log(`Failed article: ${JSON.stringify(articleSummary)}`, 'article-seeder');
    }
  }
}

// For direct script execution, we could use the following code,
// but it's not needed since we're calling this from index.ts
// Keep this commented out for reference
/*
// This is for CommonJS modules only, not for ES modules
if (typeof require !== 'undefined' && require.main === module) {
  seedArticles().then(() => {
    log('Seeding complete', 'article-seeder');
    process.exit(0);
  }).catch(error => {
    log(`Seeding failed: ${error.message}`, 'article-seeder');
    process.exit(1);
  });
}
*/