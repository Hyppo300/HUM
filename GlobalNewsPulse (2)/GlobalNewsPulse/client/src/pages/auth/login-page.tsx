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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
          if (data.token) {
            localStorage.setItem("authToken", data.token);
          }

          toast({
            title: "Login successful",
            description: "Welcome back!",
          });

          setLocation("/");
        },
        onError: (error: any) => {
          let title = "Login failed";
          let description = "Please check your credentials and try again";

          const errorData = error.response?.data || {};
          const errorEmail = errorData.email || values.email;

          if (error.message === "Email not verified") {
            title = "Email Not Verified";
            description =
              "Your account needs to be verified before you can log in. Please check your email.";

            toast({
              title,
              description: (
                <div className="space-y-2">
                  <p>{description}</p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        setLocation(
                          `/verify-email?email=${encodeURIComponent(errorEmail)}`,
                        )
                      }
                    >
                      Verify Email
                    </Button>
                  </div>
                </div>
              ),
              variant: "destructive",
              duration: 10000,
            });
            return;
          } else if (error.message === "Invalid credentials") {
            title = "Invalid Password";
            description =
              "The password you entered is incorrect. Please try again.";

            if (errorData.reason === "password") {
              toast({
                title,
                description: (
                  <div className="space-y-2">
                    <p>{description}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setLocation("/forgot-password")}
                    >
                      Reset Password
                    </Button>
                  </div>
                ),
                variant: "destructive",
              });
              return;
            }
          } else if (error.message === "User not found") {
            title = "Account Not Found";
            description =
              "No account exists with this email. Please create an account.";

            toast({
              title,
              description: (
                <div className="space-y-2">
                  <p>{description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setLocation("/register")}
                  >
                    Create Account
                  </Button>
                </div>
              ),
              variant: "destructive",
            });
            return;
          } else if (error.message?.includes("too many attempts")) {
            title = "Too Many Attempts";
            description =
              "Your account has been temporarily locked. Please try again later.";

            toast({
              title,
              description: (
                <div className="space-y-2">
                  <p>{description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setLocation("/forgot-password")}
                  >
                    Reset Password
                  </Button>
                </div>
              ),
              variant: "destructive",
            });
            return;
          }

          toast({
            title,
            description,
            variant: "destructive",
          });
        },
      });
    } catch (error) {}
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");

    if (verified === "true") {
      toast({
        title: "Email Verified Successfully",
        description: "You can now log in.",
        variant: "default",
      });

      window.history.replaceState({}, document.title, "/login");
    }
  }, []);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-[url(https://i.pinimg.com/736x/60/28/bb/6028bbed600e4948ad054c391eac6cf6.jpg)] w-full bg-cover bg-center bg-no-repeat min-h-screen">
      <div className="flex flex-col md:flex-row justify-center items-center min-h-screen px-6 py-10 gap-8 md:gap-24">
        {/* Branding */}
        <div className="text-center md:text-left max-w-sm mb-6 md:mb-0 whitespace-nowrap">
          <h1 className="text-white text-3xl sm:text-4xl md:text-5xl font-bold italic mb-2">
            Global News Hub
          </h1>
          <p className="text-gray-300 text-base sm:text-lg">
            Amplifying journalism. Connecting the world.
          </p>
        </div>

        {/* Login Card */}
        <Card className="w-full max-w-sm sm:max-w-md text-white bg-[url(https://static.vecteezy.com/system/resources/thumbnails/035/328/612/small/red-silk-fabric-texture-used-as-background-red-panne-fabric-background-of-soft-and-smooth-textile-material-crushed-velvet-luxury-scarlet-for-velvet-photo.jpg)] bg-cover bg-center bg-no-repeat backdrop-blur-lg shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Sign In
            </CardTitle>
            <CardDescription className="text-center text-sm">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your.email@example.com"
                          {...field}
                        />
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
                              <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-500" />
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
                  <Link
                    href="/forgot-password"
                    className="text-sm text-white hover:text-red-200"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#cfcfcf] text-red-800 hover:bg-[#e0e0e0]"
                  disabled={isLoading}
                >
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
              <p className="text-sm text-gray-200">
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="text-red-300 hover:text-red-500 font-medium"
                >
                  Create account
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
