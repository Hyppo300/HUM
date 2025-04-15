import { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { 
  loginSchema, 
  registerSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema
} from "@shared/schema";
import { log } from "./vite";

// JWT secret - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "24h";

// Authentication middleware
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First check if user exists from passport session
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      // User is already authenticated via passport
      return next();
    }
    
    // Otherwise check JWT token
    const token = 
      req.headers.authorization?.split(' ')[1] || 
      req.query.token as string || 
      req.cookies?.token;
    
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    
    // Get user from database
    const user = await storage.getUser(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({ message: "Email not verified" });
    }
    
    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Register authentication routes
export function registerAuthRoutes(app: Express) {
  // User registration
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Create user (password hashing is handled in storage.ts)
      const user = await storage.createUser({
        username: validatedData.username,
        email: validatedData.email,
        password: validatedData.password
      });
      
      // Return user without password
      const userWithoutPassword = {
        id: user.id,
        username: user.username,
        email: user.email,
        isVerified: user.isVerified
      };
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Registration failed", error });
    }
  });
  
  // User login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      // Get user by email
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        // Be specific that the user doesn't exist with this email
        return res.status(401).json({ message: "User not found" });
      }
      
      // Check if user is verified
      if (!user.isVerified) {
        return res.status(401).json({ 
          message: "Email not verified",
          email: user.email,
          verificationSent: true
        });
      }
      
      // Check password
      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
      if (!isPasswordValid) {
        // Use a more specific message for wrong password
        return res.status(401).json({ 
          message: "Invalid credentials",
          reason: "password", // Include reason for client to show appropriate message
          email: user.email // Let the client know email exists but password is wrong
        });
      }
      
      // Generate JWT token
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      
      // Set token in cookie (httpOnly for security)
      res.cookie("token", token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production"
      });
      
      // Also login with passport session
      if (req.login) {
        req.login(user, (err) => {
          if (err) {
            console.error("Error during session login:", err);
          }
        });
      }
      
      // Return user without password
      const userWithoutPassword = {
        id: user.id,
        username: user.username,
        email: user.email,
        isEditor: user.isEditor,
        isVerified: user.isVerified
      };
      
      res.status(200).json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Login failed", error });
    }
  });
  
  // User logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    // Clear JWT token cookie
    res.clearCookie("token");
    
    // Also logout from passport session if it exists
    if (req.logout) {
      req.logout((err) => {
        if (err) {
          console.error("Error during logout:", err);
        }
      });
    }
    
    res.status(200).json({ message: "Logged out successfully" });
  });
  
  // Get current user
  app.get("/api/auth/me", authMiddleware, (req: Request, res: Response) => {
    const user = (req as any).user;
    
    // Return user without password
    const userWithoutPassword = {
      id: user.id,
      username: user.username,
      email: user.email,
      isEditor: user.isEditor,
      isVerified: user.isVerified
    };
    
    res.status(200).json(userWithoutPassword);
  });
  
  // Verify email
  app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      const user = await storage.verifyEmail(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      res.status(200).json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(400).json({ message: "Email verification failed", error });
    }
  });
  
  // Check verification status
  app.get("/api/auth/verification-status", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const status = await storage.checkVerificationStatus(email);
      
      res.status(200).json(status);
    } catch (error) {
      console.error("Verification status check error:", error);
      res.status(400).json({ message: "Verification status check failed", error });
    }
  });
  
  // Resend verification email
  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const result = await storage.resendVerificationEmail(email);
      
      if (!result) {
        return res.status(400).json({ message: "Failed to resend verification email" });
      }
      
      res.status(200).json({ message: "Verification email sent successfully" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(400).json({ message: "Failed to resend verification email", error });
    }
  });
  
  // Forgot password
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body);
      
      const result = await storage.requestPasswordReset(validatedData.email);
      
      // Always return success to prevent email enumeration
      res.status(200).json({ message: "Password reset email sent if email exists" });
    } catch (error) {
      console.error("Forgot password error:", error);
      // Still return success to prevent email enumeration
      res.status(200).json({ message: "Password reset email sent if email exists" });
    }
  });
  
  // Check reset token validity
  app.get("/api/auth/check-reset-token", async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      // Find user with this reset token using the storage method
      const users = await storage.getUsersByResetToken(token);
      if (!users || users.length === 0) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      const user = users[0];
      
      // Check if token is expired
      if (user.resetPasswordExpiry && new Date() > user.resetPasswordExpiry) {
        return res.status(400).json({ message: "Token has expired" });
      }
      
      res.status(200).json({ message: "Token is valid" });
    } catch (error) {
      console.error("Check reset token error:", error);
      res.status(400).json({ message: "Invalid or expired token", error });
    }
  });
  
  // Reset password
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const validatedData = resetPasswordSchema.parse(req.body);
      
      const result = await storage.resetPassword(validatedData.token, validatedData.password);
      
      if (!result) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(400).json({ message: "Password reset failed", error });
    }
  });

  log("Auth routes registered", "express");
}