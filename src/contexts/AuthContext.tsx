import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInDemo = async () => {
    try {
      setLoading(true);
      
      // Call edge function to provision and sign in demo user
      const { data, error } = await supabase.functions.invoke('provision-demo-user', {
        method: 'POST'
      });

      if (error) {
        console.error('Error provisioning demo user:', error);
        toast({
          title: "Authentication error",
          description: "Failed to start demo. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (data?.session) {
        // Set the session manually
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
        
        // Update local state
        setUser(data.user);
        
        toast({
          title: "Welcome to RecruiterScreen AI",
          description: "Explore the demo with sample data"
        });
      }
    } catch (error: any) {
      console.error('Unexpected error during demo sign in:', error);
      toast({
        title: "Authentication error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed out",
        description: "You have been logged out successfully"
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}