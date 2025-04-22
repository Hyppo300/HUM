// RegisterPage.tsx

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
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
import { registerSchema } from "@shared/schema";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function RegisterPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, registerMutation } = useAuth();
  const isLoading = registerMutation.isPending;

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    try {
      await registerMutation.mutateAsync(values, {
        onSuccess: () => {
          setLocation(
            `/verify-email?email=${encodeURIComponent(values.email)}`,
          );
        },
        onError: (error: any) => {
          console.error("Registration error:", error);
          let description = "Please try again later";

          if (error.message === "Username already exists") {
            description =
              "This username is already taken. Please choose another one.";
          } else if (error.message === "Email already exists") {
            description = "An account with this email already exists.";
          }

          toast({
            title: "Registration failed",
            description,
            variant: "destructive",
          });
        },
      });
    } catch (error) {}
  }

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-[url(https://i.pinimg.com/736x/60/28/bb/6028bbed600e4948ad054c391eac6cf6.jpg)] w-full bg-cover bg-center bg-no-repeat min-h-screen">
      <div className="flex flex-col md:flex-row items-center justify-center gap-12 px-6 py-10 min-h-screen">
        {/* Left Side: Branding */}
        <div className="text-center md:text-left max-w-sm">
          <h1 className="text-white text-3xl sm:text-4xl md:text-5xl font-bold italic whitespace-nowrap mb-4">
            Global News Hub
          </h1>
          <p className="text-gray-300 text-base sm:text-lg mb-4">
            Amplifying journalism. Connecting the world.
          </p>
        </div>

        {/* Right Side: Card */}
        <Card className="w-full max-w-md bg-[url(https://static.vecteezy.com/system/resources/thumbnails/035/328/612/small/red-silk-fabric-texture-used-as-background-red-panne-fabric-background-of-soft-and-smooth-textile-material-crushed-velvet-luxury-scarlet-for-velvet-photo.jpg)] bg-cover bg-center bg-no-repeat backdrop-blur-lg shadow-lg text-black">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center text-white">
              Create an account
            </CardTitle>
            <CardDescription className="text-center text-white">
              Enter your details below to create your account
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
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="johndoe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <div className="text-xs text-gray-300 mt-1">
                        Password must contain at least:
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          <li>8 characters</li>
                          <li>One uppercase letter (A–Z)</li>
                          <li>One number (0–9)</li>
                          <li>One special character (!@#$%)</li>
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
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full bg-[#cfcfcf] text-red-800 hover:bg-[#e0e0e0]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-center w-full">
              <p className="text-sm text-gray-300">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-red-200 hover:text-red-500 font-medium"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
