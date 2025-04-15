import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, LogOut, User } from "lucide-react";

export function UserMenuSection() {
  const [, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync(undefined, {
        onSuccess: () => {
          toast({
            title: "Logged out successfully",
            description: "You have been logged out of your account.",
          });
          // Redirect to login page
          navigate("/login");
        },
        onError: (error) => {
          console.error("Logout error:", error);
          toast({
            title: "Logout failed",
            description: "There was an error logging out. Please try again.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      // Error is handled in mutation callbacks
    }
  };
  
  if (!user) {
    return (
      <Button variant="outline" onClick={() => navigate("/login")}>
        <User className="h-4 w-4 mr-2" />
        Login
      </Button>
    );
  }
  
  return (
    <Button 
      variant="outline" 
      onClick={handleLogout}
      disabled={logoutMutation.isPending}
    >
      {logoutMutation.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4 mr-2" />
      )}
      Logout
    </Button>
  );
}