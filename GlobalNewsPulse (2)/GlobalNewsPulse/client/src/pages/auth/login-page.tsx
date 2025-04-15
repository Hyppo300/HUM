import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
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
import { loginSchema } from "@shared/schema";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, loginMutation } = useAuth();
  const isLoading = loginMutation.isPending;
  const [showPassword, setShowPassword] = useState(false);
  
  // Redirect to home page if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      await loginMutation.mutateAsync(values, {
        onSuccess: (data) => {
          // Store token in localStorage for API requests
          if (data.token) {
            localStorage.setItem("authToken", data.token);
          }
          
          toast({
            title: "Login successful",
            description: "Welcome back!",
          });
          
          // Redirect to home page
          setLocation("/");
        },
        onError: (error: any) => {
          console.error("Login error:", error);
          
          let title = "Login failed";
          let description = "Please check your credentials and try again";
          
          // Extract additional information from the error response if available
          const errorData = error.response?.data || {};
          const errorEmail = errorData.email || values.email;
          
          // Detailed error messages based on the specific error
          if (error.message === "Email not verified") {
            title = "Email Not Verified";
            description = "Your account needs to be verified before you can log in. Please check your email for a verification link or request a new one.";
            
            // Show a more detailed toast with action buttons
            toast({
              title,
              description: (
                <div className="space-y-2">
                  <p>{description}</p>
                  <div className="flex gap-2 mt-2">
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => setLocation(`/verify-email?email=${encodeURIComponent(errorEmail)}`)}
                    >
                      Verify Email
                    </Button>
                  </div>
                </div>
              ),
              variant: "destructive",
              duration: 10000, // Show for longer (10 seconds)
            });
            return; // Return early since we've already shown a custom toast
          } 
          else if (error.message === "Invalid credentials") {
            title = "Invalid Password";
            description = "The password you entered is incorrect. Please try again or reset your password if you've forgotten it.";
            
            // If the server told us which part of the credentials was wrong
            if (errorData.reason === "password") {
              // Show a toast with a forgot password button
              toast({
                title,
                description: (
                  <div className="space-y-2">
                    <p>{description}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setLocation('/forgot-password')}
                    >
                      Reset Password
                    </Button>
                  </div>
                ),
                variant: "destructive",
              });
              return; // Return early since we've already shown a custom toast
            }
          }
          else if (error.message === "User not found") {
            title = "Account Not Found";
            description = "No account exists with this email. Please create an account first.";
            
            // Include a button link to register in the toast
            toast({
              title,
              description: (
                <div className="space-y-2">
                  <p>{description}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setLocation('/register')}
                  >
                    Create Account
                  </Button>
                </div>
              ),
              variant: "destructive",
            });
            return; // Return early since we've already shown a custom toast
          }
          else if (error.message?.includes("too many attempts")) {
            title = "Too Many Attempts";
            description = "Your account has been temporarily locked due to multiple failed login attempts. Please try again later or reset your password.";
            
            toast({
              title,
              description: (
                <div className="space-y-2">
                  <p>{description}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setLocation('/forgot-password')}
                  >
                    Reset Password
                  </Button>
                </div>
              ),
              variant: "destructive",
            });
            return; // Return early since we've already shown a custom toast
          }
          
          toast({
            title,
            description,
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      // Error is handled in the mutation callbacks
    }
  }

  // Check for verified=true parameter in the URL which indicates a successful email verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');
    
    if (verified === 'true') {
      toast({
        title: "Email Verified Successfully",
        description: "Your email has been verified. You can now log in to your account.",
        variant: "default",
      });
      
      // Clear the URL parameter
      window.history.replaceState({}, document.title, '/login');
    }
  }, []);
  
  // Show loading spinner while checking authentication status
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="your.email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••" 
                          {...field} 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-500" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-500" aria-hidden="true" />
                          )}
                          <span className="sr-only">
                            {showPassword ? "Hide password" : "Show password"}
                          </span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-center w-full">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{" "}
              <Link href="/register" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">
                Create account
              </Link>
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}