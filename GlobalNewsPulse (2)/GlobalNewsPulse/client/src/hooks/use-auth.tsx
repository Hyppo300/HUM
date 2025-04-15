import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { 
  User as SelectUser, 
  InsertUser, 
  Login, 
  Register,
  ForgotPassword,
  ResetPassword
} from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<{user: SelectUser, token: string}, Error, Login>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, Register>;
  forgotPasswordMutation: UseMutationResult<{ message: string }, Error, ForgotPassword>;
  resetPasswordMutation: UseMutationResult<{ message: string }, Error, ResetPassword>;
  checkResetTokenMutation: UseMutationResult<{ valid: boolean }, Error, string>;
  resendVerificationMutation: UseMutationResult<{ message: string }, Error, { email: string }>;
  verifyEmailMutation: UseMutationResult<{ message: string }, Error, string>;
  checkVerificationStatusMutation: UseMutationResult<{ isVerified: boolean, canResendAfter?: string }, Error, string>;
};

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: Login) => {
      try {
        const res = await apiRequest("POST", "/api/auth/login", credentials);
        const data = await res.json();
        return data;
      } catch (error: any) {
        // Extract rich error data from the server response if available
        const errorMessage = error.message || "Login failed";
        
        // Attach the response data to the error for handling in the component
        if (error.response) {
          try {
            const errorData = await error.response.json();
            throw Object.assign(new Error(errorMessage), { 
              response: { 
                data: errorData,
                status: error.response.status
              } 
            });
          } catch (jsonError) {
            // If we can't parse the JSON, just throw the original error
            throw error;
          }
        }
        
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
    },
    onError: (error: Error) => {
      // Basic error handling here - detailed handling in the Login component
      console.error("Authentication error:", error);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: Register) => {
      try {
        const res = await apiRequest("POST", "/api/auth/register", credentials);
        return await res.json();
      } catch (error: any) {
        // Extract rich error data from the server response if available
        const errorMessage = error.message || "Registration failed";
        
        // Attach the response data to the error for handling in the component
        if (error.response) {
          try {
            const errorData = await error.response.json();
            throw Object.assign(new Error(errorMessage), { 
              response: { 
                data: errorData,
                status: error.response.status
              } 
            });
          } catch (jsonError) {
            // If we can't parse the JSON, just throw the original error
            throw error;
          }
        }
        
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Registration successful",
        description: "Please check your email to verify your account.",
      });
    },
    onError: (error: Error) => {
      // Basic error handling here - detailed handling in the Register component
      console.error("Registration error:", error);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      toast({
        title: "Logout successful",
        description: "You have been logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPassword) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Password Reset Email Sent",
        description: "If an account exists with that email, you'll receive instructions to reset your password.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPassword) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Password Reset Successful",
        description: "Your password has been reset. You can now log in with your new password.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const checkResetTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("GET", `/api/auth/check-reset-token?token=${token}`);
      const data = await res.json();
      return { valid: data.message === "Token is valid" };
    },
    onError: (error: Error) => {
      return { valid: false };
    },
  });
  
  const verifyEmailMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("GET", `/api/auth/verify-email?token=${token}`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Verified",
        description: "Your email has been verified. You can now log in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const checkVerificationStatusMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("GET", `/api/auth/verification-status?email=${email}`);
      return await res.json();
    },
  });
  
  const resendVerificationMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const res = await apiRequest("POST", "/api/auth/resend-verification", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verification Email Sent",
        description: "A new verification email has been sent to your email address.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Resend Verification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        forgotPasswordMutation,
        resetPasswordMutation,
        checkResetTokenMutation,
        verifyEmailMutation,
        checkVerificationStatusMutation,
        resendVerificationMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
