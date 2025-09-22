import { useEffect, useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "./supabaseClient";
import type { User } from "@supabase/supabase-js";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

function Router() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [location] = useLocation();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = user?.email === 'harryroger798@gmail.com' || user?.email === 'admin@byteshopotp.co.site';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="inline-flex items-center justify-center w-8 h-8 bg-primary rounded-md mr-3">
                  <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-foreground">ByteVault OTP Hub</h1>
              </div>
            </div>
            
            <nav className="hidden md:flex space-x-8">
              <Link 
                href="/"
                className={`hover:text-primary transition-colors font-medium ${
                  location === "/" 
                    ? "text-foreground border-b-2 border-primary" 
                    : "text-muted-foreground"
                }`}
              >
                Dashboard
              </Link>
              {isAdmin && (
                <Link 
                  href="/admin"
                  className={`hover:text-primary transition-colors font-medium ${
                    location === "/admin" 
                      ? "text-foreground border-b-2 border-primary" 
                      : "text-muted-foreground"
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-foreground">{user.email}</span>
              </div>
              <button 
                onClick={() => supabase.auth.signOut()}
                className="text-muted-foreground hover:text-destructive transition-colors"
                data-testid="button-logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <Switch>
        <Route path="/" component={() => <Dashboard user={user} />} />
        {isAdmin && <Route path="/admin" component={() => <Admin user={user} />} />}
        <Route component={NotFound} />
      </Switch>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-muted-foreground">
            Contact: <a href="mailto:admin@byteshopotp.co.site" className="text-primary hover:underline">admin@byteshopotp.co.site</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
