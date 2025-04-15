import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import ArticlePage from "@/pages/article-page";
import { useEffect } from "react";

// Auth pages
import LoginPage from "@/pages/auth/login-page";
import RegisterPage from "@/pages/auth/register-page";
import VerifyEmailPage from "@/pages/auth/verify-email-page";
import ForgotPasswordPage from "@/pages/auth/forgot-password-page";
import ResetPasswordPage from "@/pages/auth/reset-password-page";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

// Import the lib/protected-route component for reuse
import { ProtectedRoute } from "@/lib/protected-route";

function Router() {
  const { verifyEmailMutation } = useAuth();
  const [location, setLocation] = useLocation();
  
  // Handle email verification from URL parameters
  useEffect(() => {
    // Check for verification token in URL
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('token');
    const verifyEmail = params.get('verifyEmail');
    
    if ((verifyEmail === 'true' || location === '/') && verifyToken) {
      console.log("Found verification token in URL, attempting to verify email");
      
      // Call the verify email API
      verifyEmailMutation.mutate(verifyToken, {
        onSuccess: () => {
          // Clear the URL parameters and redirect to login page
          window.history.replaceState({}, document.title, '/login?verified=true');
          setLocation('/login?verified=true');
        },
        onError: (error) => {
          console.error("Email verification failed:", error);
          // Redirect to verify-email page with error
          setLocation('/verify-email?error=invalid_token');
        }
      });
    }
  }, [location]);
  
  return (
    <Switch>
      {/* Public Auth Routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      {/* Protected Routes - require authentication */}
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/article/:id" component={ArticlePage} />
      
      {/* 404 Route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;