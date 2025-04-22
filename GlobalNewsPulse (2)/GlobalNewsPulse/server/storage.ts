import {
  User,
  Article,
  Comment,
  InsertUser,
  InsertArticle,
  InsertComment,
  Login,
  Register,
  ForgotPassword,
  ResetPassword,
} from "@shared/schema";
import { users, articles, comments } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { db } from "./db";
import { eq, and, desc, like, asc, or, count } from "drizzle-orm";
import connect from "connect-pg-simple";
import { log } from "./vite";
import crypto from "crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const MemoryStore = createMemoryStore(session);
const PgSession = connect(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByResetToken(token: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  verifyEmail(token: string): Promise<User | undefined>;
  requestPasswordReset(email: string): Promise<boolean>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
  checkVerificationStatus(
    email: string,
  ): Promise<{ isVerified: boolean; canResendAfter?: Date }>;
  resendVerificationEmail(email: string): Promise<boolean>;

  // Article methods
  createArticle(article: InsertArticle): Promise<Article>;
  getArticles(options?: {
    country?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ articles: Article[]; totalCount: number }>;
  getArticleById(id: number): Promise<Article | undefined>;
  getArticleByUrl(url: string): Promise<Article | undefined>;
  updateArticle(
    id: number,
    article: Partial<InsertArticle> & { aiEnhancedContent?: string },
  ): Promise<Article>;
  deleteArticle(id: number): Promise<void>;

  // Comment methods
  createComment(comment: InsertComment): Promise<Comment>;
  getCommentsByArticle(articleId: number): Promise<Comment[]>;
  getCommentById(id: number): Promise<Comment | undefined>;

  sessionStore: session.Store;
}

// If we have a DATABASE_URL, use the PostgreSQL storage, otherwise use memory storage
const USE_DB = !!process.env.DATABASE_URL;

// Database-backed storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Use PostgreSQL for session storage if DATABASE_URL is available
    if (USE_DB) {
      this.sessionStore = new PgSession({
        conObject: {
          connectionString: process.env.DATABASE_URL,
        },
        tableName: "session",
        createTableIfMissing: true,
      });
      log("Using PostgreSQL for session storage", "express");
    } else {
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000,
      });
      log("Using memory for session storage", "express");
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsersByResetToken(token: string): Promise<User[]> {
    try {
      const userResults = await db
        .select()
        .from(users)
        .where(eq(users.resetPasswordToken, token));
      return userResults;
    } catch (error) {
      console.error(`Error getting users by reset token: ${error}`);
      return [];
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // Generate a verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const now = new Date();
      const verificationExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      // Hash the password
      const hashedPassword = await bcrypt.hash(insertUser.password, 10);

      // Create the user with verification token
      const [user] = await db
        .insert(users)
        .values({
          ...insertUser,
          password: hashedPassword,
          isVerified: false,
          verificationToken,
          verificationTokenExpiry: verificationExpiry,
        })
        .returning();

      // Send verification email
      await this.sendVerificationEmail(user.email, verificationToken);

      return user;
    } catch (error) {
      console.error(`Error creating user: ${error}`);
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<User | undefined> {
    try {
      // Find user with this verification token
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.verificationToken, token));

      if (!user) {
        return undefined;
      }

      // Check if token is expired
      if (
        user.verificationTokenExpiry &&
        new Date() > user.verificationTokenExpiry
      ) {
        return undefined;
      }

      // Update user to verified status
      const [updatedUser] = await db
        .update(users)
        .set({
          isVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
        })
        .where(eq(users.id, user.id))
        .returning();

      return updatedUser;
    } catch (error) {
      console.error(`Error verifying email: ${error}`);
      return undefined;
    }
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      // Check if user exists
      const user = await this.getUserByEmail(email);
      if (!user) {
        return false;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const now = new Date();
      const resetExpiry = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour

      // Update user with reset token
      await db
        .update(users)
        .set({
          resetPasswordToken: resetToken,
          resetPasswordExpiry: resetExpiry,
        })
        .where(eq(users.id, user.id));

      // Send password reset email
      await this.sendPasswordResetEmail(email, resetToken);

      return true;
    } catch (error) {
      console.error(`Error requesting password reset: ${error}`);
      return false;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Find user with this reset token
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.resetPasswordToken, token));

      if (!user) {
        return false;
      }

      // Check if token is expired
      if (user.resetPasswordExpiry && new Date() > user.resetPasswordExpiry) {
        return false;
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user with new password
      await db
        .update(users)
        .set({
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpiry: null,
        })
        .where(eq(users.id, user.id));

      return true;
    } catch (error) {
      console.error(`Error resetting password: ${error}`);
      return false;
    }
  }

  async checkVerificationStatus(
    email: string,
  ): Promise<{ isVerified: boolean; canResendAfter?: Date }> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) {
        return { isVerified: false };
      }

      if (user.isVerified) {
        return { isVerified: true };
      }

      // If token expiry is available and it's less than 60 seconds ago, user must wait
      if (user.verificationTokenExpiry) {
        const tokenSetTime = new Date(
          user.verificationTokenExpiry.getTime() - 24 * 60 * 60 * 1000,
        ); // When token was created
        const cooldownEnd = new Date(tokenSetTime.getTime() + 60 * 1000); // 60 seconds after token creation

        if (new Date() < cooldownEnd) {
          return { isVerified: false, canResendAfter: cooldownEnd };
        }
      }

      return { isVerified: false };
    } catch (error) {
      console.error(`Error checking verification status: ${error}`);
      return { isVerified: false };
    }
  }

  async resendVerificationEmail(email: string): Promise<boolean> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user || user.isVerified) {
        return false;
      }

      // Generate a new verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const now = new Date();
      const verificationExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with new verification token
      await db
        .update(users)
        .set({
          verificationToken,
          verificationTokenExpiry: verificationExpiry,
        })
        .where(eq(users.id, user.id));

      // Send verification email
      await this.sendVerificationEmail(email, verificationToken);

      return true;
    } catch (error) {
      console.error(`Error resending verification email: ${error}`);
      return false;
    }
  }

  // Helper method to send verification email
  private async sendVerificationEmail(
    email: string,
    token: string,
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER || "wtariq970@gmail.com",
        pass: process.env.GMAIL_APP_PASSWORD || "jurn uhou hirq wxyk", // App password for Gmail
      },
    });

    // Important: This should match the path we set up in server/routes.ts to handle email verification redirects
    const verificationUrl = `${process.env.APP_URL || "http://localhost:5000"}/verify-email?token=${token}`;

    const mailOptions = {
      from: process.env.GMAIL_USER || "wtariq970@gmail.com",
      to: email,
      subject: "Verify your email for News Aggregation Platform",
      html: `
        <h1>Email Verification</h1>
        <p>Thank you for registering. Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  // Helper method to send password reset email
  private async sendPasswordResetEmail(
    email: string,
    token: string,
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER || "wtariq970@gmail.com",
        pass: process.env.GMAIL_APP_PASSWORD || "jurn uhou hirq wxyk", // App password for Gmail
      },
    });

    const resetUrl = `${process.env.APP_URL || "http://localhost:5000"}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.GMAIL_USER || "wtariq970@gmail.com",
      to: email,
      subject: "Reset your password for News Aggregation Platform",
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  // Article methods
  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const [article] = await db
      .insert(articles)
      .values(insertArticle)
      .returning();
    return article;
  }

  async getArticles(
    options: {
      country?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{
    articles: Article[];
    totalCount: number;
    totalPages?: number;
    page?: number;
    pageSize?: number;
  }> {
    try {
      const { country, page = 1, pageSize = 30 } = options;
      const offset = (page - 1) * pageSize;

      // Build and execute query in one go to avoid type issues
      let articlesQuery = db.select().from(articles);

      // Apply country filter if provided
      if (country) {
        // For debugging
        console.log(`Filtering articles by country: ${country}`);

        // Handle special cases for country filtering
        if (country === "GLOBAL") {
          // For GLOBAL, include articles marked as GLOBAL or GLOBAL-TRENDING
          // (PK is no longer used, all articles have GLOBAL as default)
          articlesQuery = articlesQuery.where(
            or(
              eq(articles.country, "GLOBAL"),
              eq(articles.country, "GLOBAL-TRENDING"),
            ),
          );
        } else {
          // For specific countries, match country code exactly
          articlesQuery = articlesQuery.where(eq(articles.country, country));
        }
      }

      // Quick check: Are there any matching articles at all?
      const quickCountPromise = Promise.race([
        db
          .select({ count: count() })
          .from(articles)
          .where(
            country === "GLOBAL"
              ? or(
                  eq(articles.country, "GLOBAL"),
                  eq(articles.country, "GLOBAL-TRENDING"),
                )
              : country
                ? eq(articles.country, country)
                : undefined,
          ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Quick count timeout")), 2000),
        ),
      ]);

      try {
        const quickCountResult = (await quickCountPromise) as any;
        const quickCount = Number(quickCountResult?.[0]?.count || 0);

        // If no articles found, return empty result immediately
        if (quickCount === 0) {
          console.log(`Found 0 articles in database, returning immediately`);
          return {
            articles: [],
            totalCount: 0,
            totalPages: 0,
            page,
            pageSize,
          };
        }

        // If we get here, we know there are articles to fetch
        console.log(
          `Quick count found ${quickCount} articles, proceeding with full query`,
        );
      } catch (err) {
        console.error("Quick count timed out, continuing with main query");
      }

      // Execute actual query with timeout
      try {
        const articlesPromise = Promise.race([
          articlesQuery
            .orderBy(desc(articles.createdAt))
            .limit(pageSize)
            .offset(offset),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Articles query timeout")), 5000),
          ),
        ]);

        // Total count with timeout
        const countQuery = db.select({ count: count() }).from(articles);
        if (country) {
          if (country === "GLOBAL") {
            countQuery.where(
              or(
                eq(articles.country, "GLOBAL"),
                eq(articles.country, "GLOBAL-TRENDING"),
              ),
            );
          } else {
            countQuery.where(eq(articles.country, country));
          }
        }

        const totalCountPromise = Promise.race([
          countQuery,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Count query timeout")), 5000),
          ),
        ]);

        // Execute both main queries
        const results = (await articlesPromise) as Article[];
        let totalCount = 0;

        try {
          const totalCountResult = (await totalCountPromise) as any;
          totalCount = Number(totalCountResult[0]?.count || 0);
        } catch (countErr) {
          console.error("Count query timed out, using results length as count");
          totalCount = results.length;
        }

        const totalPages = Math.ceil(totalCount / pageSize);

        return {
          articles: results,
          totalCount,
          totalPages,
          page,
          pageSize,
        };
      } catch (queryErr) {
        console.error(
          `Articles query timed out, returning empty array: ${queryErr}`,
        );
        return {
          articles: [],
          totalCount: 0,
          totalPages: 0,
          page,
          pageSize,
        };
      }
    } catch (error) {
      console.error(`Database error in getArticles: ${error}`);
      // Return empty array to avoid breaking the UI on database errors
      return {
        articles: [],
        totalCount: 0,
        totalPages: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 30,
      };
    }
  }

  async getArticleById(id: number): Promise<Article | undefined> {
    try {
      const [article] = await db
        .select()
        .from(articles)
        .where(eq(articles.id, id));
      return article;
    } catch (error) {
      console.error(`Database error in getArticleById: ${error}`);
      return undefined;
    }
  }

  async getArticleByUrl(url: string): Promise<Article | undefined> {
    try {
      const [article] = await db
        .select()
        .from(articles)
        .where(eq(articles.sourceUrl, url));
      return article;
    } catch (error) {
      console.error(`Database error in getArticleByUrl: ${error}`);
      return undefined;
    }
  }

  async updateArticle(
    id: number,
    articleUpdate: Partial<InsertArticle> & { aiEnhancedContent?: string },
  ): Promise<Article> {
    try {
      const [updatedArticle] = await db
        .update(articles)
        .set(articleUpdate)
        .where(eq(articles.id, id))
        .returning();
      return updatedArticle;
    } catch (error) {
      console.error(`Database error in updateArticle: ${error}`);
      throw new Error(`Failed to update article: ${error}`);
    }
  }

  async deleteArticle(id: number): Promise<void> {
    try {
      await db.delete(articles).where(eq(articles.id, id));
    } catch (error) {
      console.error(`Database error in deleteArticle: ${error}`);
      throw new Error(`Failed to delete article: ${error}`);
    }
  }

  // Comment methods
  async createComment(insertComment: InsertComment): Promise<Comment> {
    try {
      const [comment] = await db
        .insert(comments)
        .values(insertComment)
        .returning();
      return comment;
    } catch (error) {
      console.error(`Database error in createComment: ${error}`);
      throw new Error(`Failed to create comment: ${error}`);
    }
  }

  async getCommentsByArticle(articleId: number): Promise<Comment[]> {
    try {
      const results = await db
        .select()
        .from(comments)
        .where(eq(comments.articleId, articleId))
        .orderBy(asc(comments.createdAt));
      return results;
    } catch (error) {
      console.error(`Database error in getCommentsByArticle: ${error}`);
      return []; // Return empty array to avoid breaking the UI
    }
  }

  async getCommentById(id: number): Promise<Comment | undefined> {
    try {
      const [comment] = await db
        .select()
        .from(comments)
        .where(eq(comments.id, id));
      return comment;
    } catch (error) {
      console.error(`Database error in getCommentById: ${error}`);
      return undefined;
    }
  }
}

// Original memory-based storage implementation (for fallback)
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private articles: Map<number, Article>;
  private comments: Map<number, Comment>;
  private currentUserId: number;
  private currentArticleId: number;
  private currentCommentId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.articles = new Map();
    this.comments = new Map();
    this.currentUserId = 1;
    this.currentArticleId = 1;
    this.currentCommentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Add placeholder data
    this.initializePlaceholderData();
  }

  private initializePlaceholderData() {
    // Create a test editor user
    const now = new Date();
    const editorUser: User = {
      id: this.currentUserId++,
      username: "editor",
      email: "editor@example.com",
      password: "test123", // In a real app, this would be hashed
      isEditor: true,
      isVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
      createdAt: now,
    };
    this.users.set(editorUser.id, editorUser);

    // Re-added placeholder articles for frontend development
    const createPlaceholderArticle = (
      id: number,
      title: string,
      summary: string,
      country: string,
      category: string,
      trending: boolean = false,
      createdAt: Date = new Date(), // 👈 Optional parameter with default
    ): Article => {
      const articleCountry = trending ? `${country}-TRENDING` : country;
      return {
        id,
        title,
        summary,
        aiEnhancedContent: `<p>${summary}</p><p>This is a placeholder article content for frontend development purposes. It contains multiple paragraphs of text to simulate a real news article.</p><p>The article discusses ${title.toLowerCase()} and provides insights into how this topic affects global news and current affairs.</p><p>Additional details would be provided in a real news article, along with quotes from relevant sources and statistical data when applicable.</p>`,
        country: articleCountry,
        category,
        sourceUrl: `https://example.com/articles/${id}`,
        sourceApi: "PlaceholderAPI",
        originalContent: "Placeholder content for development",
        originalJson: "{}",
        createdAt: new Date(),
        authorId: editorUser.id,
      };
    };

    // Global news
    // Global news
    this.articles.set(
      1,
      createPlaceholderArticle(
        1,
        "Global Climate Summit Achieves Breakthrough Agreement",
        "World leaders have reached a historic climate agreement...",
        "GLOBAL",
        "environment",
        false,
        new Date("2024-12-01"),
      ),
    );
    // this.articles.get(1)!.createdAt = new Date(); // Today

    this.articles.set(
      2,
      createPlaceholderArticle(
        2,
        "Tech Giants Announce Joint Initiative for Quantum Computing",
        "Major tech companies form an alliance for quantum research.",
        "GLOBAL",
        "technology",
      ),
    );
    // this.articles.get(2)!.createdAt = new Date(Date.now() - 5 * 86400000); // 5 days ago

    this.articles.set(
      3,
      createPlaceholderArticle(
        3,
        "Breaking: Artificial Intelligence Makes Major Medical Discovery",
        "An AI system has identified a new antibiotic compound...",
        "GLOBAL",
        "science",
        true,
      ),
    );
    // this.articles.get(3)!.createdAt = new Date(Date.now() - 12 * 86400000); // 12 days ago

    // US news
    this.articles.set(
      4,
      createPlaceholderArticle(
        4,
        "US Economy Shows Strong Growth in Second Quarter",
        "The US economy exceeded expectations with 4.2% growth.",
        "US",
        "business",
      ),
    );
    // this.articles.get(4)!.createdAt = new Date(Date.now() - 30 * 86400000); // 1 month ago

    this.articles.set(
      5,
      createPlaceholderArticle(
        5,
        "Historic Infrastructure Bill Passes in US Congress",
        "The US Congress has passed a $1.2 trillion bill...",
        "US",
        "politics",
        true,
      ),
    );
    // this.articles.get(5)!.createdAt = new Date(Date.now() - 60 * 86400000); // 2 months ago

    // UK news
    this.articles.set(
      6,
      createPlaceholderArticle(
        6,
        "UK Announces New Green Energy Initiative",
        "The UK plans to power homes with offshore wind by 2030.",
        "GB",
        "environment",
      ),
    );
    // this.articles.get(6)!.createdAt = new Date(); // Today

    // Japan news
    this.articles.set(
      7,
      createPlaceholderArticle(
        7,
        "Japan's Central Bank Adjusts Monetary Policy",
        "The Bank of Japan shifts monetary policy to allow wider bond yields.",
        "JP",
        "business",
      ),
    );
    // this.articles.get(7)!.createdAt = new Date(Date.now() - 7 * 86400000); // 1 week ago

    // India trending news
    this.articles.set(
      8,
      createPlaceholderArticle(
        8,
        "India Launches Record-Breaking Satellite Constellation",
        "India launched 104 satellites in one mission.",
        "IN",
        "science",
        true,
      ),
    );
    // this.articles.get(8)!.createdAt = new Date(Date.now() - 10 * 86400000); // 10 days ago

    // Germany news
    this.articles.set(
      9,
      createPlaceholderArticle(
        9,
        "German Auto Industry Accelerates Electric Vehicle Production",
        "German automakers scale EV production amid high demand.",
        "DE",
        "business",
      ),
    );
    // this.articles.get(9)!.createdAt = new Date(Date.now() - 20 * 86400000); // 20 days ago

    // Brazil news
    this.articles.set(
      10,
      createPlaceholderArticle(
        10,
        "Brazil Unveils New Conservation Plan for Amazon Rainforest",
        "Brazil introduces plan to protect Amazon and fight illegal logging.",
        "BR",
        "environment",
      ),
    );
    // this.articles.get(10)!.createdAt = new Date(Date.now() - 1 * 86400000); // 1 day ago
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }

  async getUsersByResetToken(token: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.resetPasswordToken === token,
    );
  }

  async verifyEmail(token: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(
      (user) => user.verificationToken === token,
    );

    if (!user) {
      return undefined;
    }

    if (
      user.verificationTokenExpiry &&
      new Date() > user.verificationTokenExpiry
    ) {
      return undefined;
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;

    this.users.set(user.id, user);
    return user;
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return false;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const resetExpiry = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetExpiry;

    this.users.set(user.id, user);

    // In memory storage, we'll just log instead of sending email
    console.log(`Password reset requested for ${email}, token: ${resetToken}`);

    return true;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = Array.from(this.users.values()).find(
      (user) => user.resetPasswordToken === token,
    );

    if (!user) {
      return false;
    }

    if (user.resetPasswordExpiry && new Date() > user.resetPasswordExpiry) {
      return false;
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;

    this.users.set(user.id, user);

    return true;
  }

  async checkVerificationStatus(
    email: string,
  ): Promise<{ isVerified: boolean; canResendAfter?: Date }> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return { isVerified: false };
    }

    if (user.isVerified) {
      return { isVerified: true };
    }

    // If token expiry is available and it's less than 60 seconds ago, user must wait
    if (user.verificationTokenExpiry) {
      const tokenSetTime = new Date(
        user.verificationTokenExpiry.getTime() - 24 * 60 * 60 * 1000,
      ); // When token was created
      const cooldownEnd = new Date(tokenSetTime.getTime() + 60 * 1000); // 60 seconds after token creation

      if (new Date() < cooldownEnd) {
        return { isVerified: false, canResendAfter: cooldownEnd };
      }
    }

    return { isVerified: false };
  }

  async resendVerificationEmail(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    if (!user || user.isVerified) {
      return false;
    }

    // Generate a new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const verificationExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationExpiry;

    this.users.set(user.id, user);

    // In memory storage, we'll just log instead of sending email
    console.log(
      `Verification email resent for ${email}, token: ${verificationToken}`,
    );

    return true;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const user: User = {
      ...insertUser,
      id,
      isEditor: false,
      isVerified: false,
      verificationToken,
      verificationTokenExpiry: verificationExpiry,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
      createdAt: now,
    };

    this.users.set(id, user);
    console.log(
      `Memory storage: User created with email ${insertUser.email}, verification token: ${verificationToken}`,
    );
    return user;
  }

  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const id = this.currentArticleId++;
    const article: Article = {
      ...insertArticle,
      id,
      createdAt: new Date(),
      aiEnhancedContent: null,
      sourceUrl: insertArticle.sourceUrl || null,
      originalJson: insertArticle.originalJson || null,
      authorId: insertArticle.authorId || null,
    };
    this.articles.set(id, article);
    return article;
  }

  async getArticles(options?: {
    country?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ articles: Article[]; totalCount: number }> {
    const { country, page = 1, pageSize = 30 } = options || {};
    const offset = (page - 1) * pageSize;

    // Get all articles and apply filtering if needed
    let filteredArticles = Array.from(this.articles.values());

    if (country) {
      console.log(`Filtering in-memory articles by country: ${country}`);

      if (country.toUpperCase() === "GLOBAL") {
        // For GLOBAL, include articles with GLOBAL or GLOBAL-TRENDING
        // (PK is no longer used, all articles have GLOBAL as default)
        filteredArticles = filteredArticles.filter(
          (article) =>
            article.country?.toUpperCase() === "GLOBAL" ||
            article.country?.toUpperCase() === "GLOBAL-TRENDING",
        );
      } else {
        // For specific countries, match the country code case-insensitive
        filteredArticles = filteredArticles.filter(
          (article) => article.country?.toUpperCase() === country.toUpperCase(),
        );
      }
    }

    // Sort by created date (newest first)
    filteredArticles.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    // Apply pagination
    const paginatedArticles = filteredArticles.slice(offset, offset + pageSize);

    return {
      articles: paginatedArticles,
      totalCount: filteredArticles.length,
    };
  }

  async getArticleById(id: number): Promise<Article | undefined> {
    return this.articles.get(id);
  }

  async getArticleByUrl(url: string): Promise<Article | undefined> {
    return Array.from(this.articles.values()).find(
      (article) => article.sourceUrl === url,
    );
  }

  async updateArticle(
    id: number,
    article: Partial<InsertArticle> & { aiEnhancedContent?: string },
  ): Promise<Article> {
    const existing = await this.getArticleById(id);
    if (!existing) {
      throw new Error("Article not found");
    }
    const updated = { ...existing, ...article };
    this.articles.set(id, updated);
    return updated;
  }

  async deleteArticle(id: number): Promise<void> {
    this.articles.delete(id);
    // Also delete associated comments
    const commentsToDelete = Array.from(this.comments.values())
      .filter((comment) => comment.articleId === id)
      .map((comment) => comment.id);
    commentsToDelete.forEach((commentId) => this.comments.delete(commentId));
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = this.currentCommentId++;
    const comment: Comment = {
      ...insertComment,
      id,
      createdAt: new Date(),
      isExplainer: insertComment.isExplainer || false,
    };
    this.comments.set(id, comment);
    return comment;
  }

  async getCommentsByArticle(articleId: number): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter((comment) => comment.articleId === articleId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCommentById(id: number): Promise<Comment | undefined> {
    return this.comments.get(id);
  }
}

// Choose storage implementation based on environment
export const storage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemStorage();

console.log(
  `Using ${process.env.DATABASE_URL ? "Database" : "Memory"} storage`,
);
