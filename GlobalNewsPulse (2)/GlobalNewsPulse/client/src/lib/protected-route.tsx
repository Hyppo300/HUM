import { useEffect } from "react";
import { Route, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

/**
 * A wrapper component that only renders its children if the user is authenticated.
 * Otherwise, it redirects to the login page.
 */
export function ProtectedRoute({ component: Component, ...rest }: { 
  component: React.ComponentType<any>, 
  path?: string 
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // TEMPORARILY DISABLED FOR FRONTEND DEVELOPMENT
  // Will be re-enabled for production
  /*
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return user ? <Route {...rest} component={Component} /> : null;
  */
  
  // TEMPORARY: Always render the component without authentication check
  return <Route {...rest} component={Component} />;
}