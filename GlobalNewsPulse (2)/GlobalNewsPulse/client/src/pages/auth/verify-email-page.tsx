import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, Mail } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function VerifyEmailPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { verifyEmailMutation, checkVerificationStatusMutation, resendVerificationMutation } = useAuth();
  
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "success" | "error">("pending");
  const [email, setEmail] = useState<string>("");
  const [canResend, setCanResend] = useState(true);
  const [resendCountdown, setResendCountdown] = useState(0);
  
  const isVerifying = verifyEmailMutation.isPending;
  const isResending = resendVerificationMutation.isPending;
  
  // Get token and error from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const emailParam = params.get("email");
    const errorParam = params.get("error");
    
    if (emailParam) {
      setEmail(emailParam);
      checkVerificationStatus(emailParam);
    }
    
    // Handle error parameter in the URL
    if (errorParam) {
      setVerificationStatus("error");
      
      const errorMessages = {
        "missing_token": "No verification token was provided. Please check your email for the complete verification link.",
        "invalid_token": "The verification link is invalid or has expired. Please request a new one.",
        "verification_failed": "We couldn't verify your email due to a technical issue. Please try again or contact support."
      };
      
      const errorMessage = errorMessages[errorParam as keyof typeof errorMessages] || 
                          "There was a problem verifying your email. Please try again.";
      
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
    // If token is present and no errors, try to verify
    else if (token) {
      verifyEmail(token);
    }
  }, [location]);
  
  // Handle countdown for resend button
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (resendCountdown === 0) {
      setCanResend(true);
    }
  }, [resendCountdown]);
  
  async function checkVerificationStatus(emailToCheck: string) {
    try {
      const data = await checkVerificationStatusMutation.mutateAsync(emailToCheck);
      
      if (data.isVerified) {
        setVerificationStatus("success");
        setTimeout(() => {
          setLocation("/login");
        }, 3000);
      } else if (data.canResendAfter) {
        // Calculate seconds left until user can resend
        const canResendAfter = new Date(data.canResendAfter);
        const secondsLeft = Math.ceil((canResendAfter.getTime() - Date.now()) / 1000);
        
        if (secondsLeft > 0) {
          setCanResend(false);
          setResendCountdown(secondsLeft);
        }
      }
    } catch (error) {
      console.error("Error checking verification status:", error);
    }
  }
  
  async function verifyEmail(token: string) {
    try {
      await verifyEmailMutation.mutateAsync(token, {
        onSuccess: () => {
          setVerificationStatus("success");
          
          // Redirect to login page after a delay
          setTimeout(() => {
            setLocation("/login");
          }, 3000);
        },
        onError: () => {
          setVerificationStatus("error");
        }
      });
    } catch (error) {
      // Error handling is done in mutation callbacks
    }
  }
  
  async function resendVerificationEmail() {
    if (!canResend || !email) return;
    
    try {
      await resendVerificationMutation.mutateAsync({ email }, {
        onSuccess: () => {
          // Set cooldown
          setCanResend(false);
          setResendCountdown(60);
        }
      });
    } catch (error) {
      // Error handling is done in mutation callbacks
    }
  }
  
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Email Verification</CardTitle>
          <CardDescription className="text-center">
            {verificationStatus === "pending" && "Please verify your email address to continue"}
            {verificationStatus === "success" && "Your email has been verified successfully"}
            {verificationStatus === "error" && "There was a problem verifying your email"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {isVerifying ? (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p>Verifying your email...</p>
            </div>
          ) : verificationStatus === "success" ? (
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p>Your email has been verified successfully!</p>
              <p className="text-sm text-gray-500">Redirecting to login page...</p>
            </div>
          ) : verificationStatus === "error" ? (
            <div className="flex flex-col items-center space-y-4">
              <AlertCircle className="h-16 w-16 text-red-500" />
              <p>The verification link may have expired or is invalid.</p>
              {email && (
                <Button 
                  onClick={resendVerificationEmail} 
                  disabled={isResending || !canResend}
                  variant="outline"
                  className="mt-4"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : !canResend ? (
                    `Resend in ${resendCountdown}s`
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Resend verification email
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <Mail className="h-16 w-16 text-primary" />
              <p className="text-center">
                We've sent a verification link to <span className="font-medium">{email}</span>.
                Please check your inbox and click the link to verify your email address.
              </p>
              <p className="text-sm text-gray-500">
                If you don't see the email, check your spam folder.
              </p>
              <Button 
                onClick={resendVerificationEmail} 
                disabled={isResending || !canResend}
                variant="outline"
                className="mt-4"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : !canResend ? (
                  `Resend in ${resendCountdown}s`
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Resend verification email
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-center">
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
              Back to login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}