import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { resetPasswordSchema } from "@shared/schema";
import { z } from "zod";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function ResetPasswordPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { resetPasswordMutation, checkResetTokenMutation } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<"valid" | "invalid" | "checking">("checking");
  
  const isLoading = resetPasswordMutation.isPending;
  const isCheckingToken = checkResetTokenMutation.isPending;

  // Extract token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    
    if (tokenParam) {
      setToken(tokenParam);
      checkTokenValidity(tokenParam);
    } else {
      setTokenStatus("invalid");
    }
  }, [location]);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function checkTokenValidity(tokenToCheck: string) {
    try {
      const result = await checkResetTokenMutation.mutateAsync(tokenToCheck);
      
      if (result.valid) {
        setTokenStatus("valid");
      } else {
        throw new Error("Invalid or expired token");
      }
    } catch (error) {
      console.error("Invalid or expired token:", error);
      setTokenStatus("invalid");
      toast({
        title: "Invalid or expired token",
        description: "This password reset link is invalid or has expired. Please request a new one.",
        variant: "destructive",
      });
    }
  }

  async function onSubmit(values: z.infer<typeof resetPasswordSchema> & { token?: string }) {
    if (!token) return;
    
    try {
      // Include the token from URL in the request
      const dataToSubmit = {
        ...values,
        token,
      };
      
      await resetPasswordMutation.mutateAsync(dataToSubmit, {
        onSuccess: () => {
          setIsSubmitted(true);
          
          // Redirect to login page after a delay
          setTimeout(() => {
            setLocation("/login");
          }, 3000);
        },
        onError: (error) => {
          console.error("Password reset error:", error);
          
          toast({
            title: "Password reset failed",
            description: "There was an error resetting your password. Please try again or request a new reset link.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      // Error handling is done in the mutation callbacks
    }
  }

  if (tokenStatus === "checking") {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-10 space-y-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p>Verifying your reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Invalid Reset Link</CardTitle>
            <CardDescription className="text-center">
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4 py-4">
            <AlertCircle className="h-16 w-16 text-red-500" />
            <p className="text-center">
              The password reset link you clicked is invalid or has expired.
              Please request a new password reset link.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request New Reset Link</Link>
            </Button>
            <div className="text-center w-full pt-2">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
                Back to login
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Reset your password</CardTitle>
          <CardDescription className="text-center">
            {!isSubmitted 
              ? "Enter your new password below"
              : "Your password has been reset successfully"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSubmitted ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                      <div className="text-xs text-gray-500 mt-1">
                        Password must contain at least:
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          <li>8 characters</li>
                          <li>One uppercase letter (A-Z)</li>
                          <li>One number (0-9)</li>
                          <li>One special character (!@#$%...)</li>
                        </ul>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting password...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="flex flex-col items-center space-y-4 py-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-center">
                Your password has been reset successfully!
                You can now log in with your new password.
              </p>
              <p className="text-sm text-gray-500">
                Redirecting to login page...
              </p>
            </div>
          )}
        </CardContent>
        {!isSubmitted && (
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-center w-full">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
                Back to login
              </Link>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}