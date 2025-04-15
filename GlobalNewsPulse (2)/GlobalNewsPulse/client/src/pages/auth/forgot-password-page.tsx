import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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
import { forgotPasswordSchema } from "@shared/schema";
import { z } from "zod";
import { Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const { forgotPasswordMutation } = useAuth();
  const isLoading = forgotPasswordMutation.isPending;
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof forgotPasswordSchema>) {
    try {
      await forgotPasswordMutation.mutateAsync(values, {
        onSuccess: () => {
          setIsSubmitted(true);
        },
        onError: (error) => {
          console.error("Forgot password error:", error);
          
          // We don't want to reveal if an email exists or not for security reasons
          // So we show the same success message even if the email doesn't exist
          setIsSubmitted(true);
        }
      });
    } catch (error) {
      // Error is handled in mutation callbacks
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Reset your password</CardTitle>
          <CardDescription className="text-center">
            {!isSubmitted 
              ? "Enter your email address and we'll send you a link to reset your password"
              : "Check your email for a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSubmitted ? (
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="flex flex-col items-center space-y-4 py-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-center">
                We've sent a password reset link to your email address. 
                Please check your inbox and follow the instructions to reset your password.
              </p>
              <p className="text-sm text-gray-500">
                If you don't see the email, check your spam folder.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-center w-full">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Link href="/login" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">
                Back to login
              </Link>
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}