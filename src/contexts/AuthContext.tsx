import { createContext, useContext, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { DEMO_MODE, DEMO_USER } from '@/lib/demoConstants';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // In demo mode, always provide a mock user
  const mockUser = DEMO_MODE ? {
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    app_metadata: {},
    user_metadata: { role: DEMO_USER.role },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User : null;

  const [user] = useState<User | null>(mockUser);
  const [loading] = useState(false);

  const signInDemo = async () => {
    // In demo mode, no actual sign in needed
    console.log('Demo mode - no authentication required');
  };

  const signOut = async () => {
    // In demo mode, no actual sign out needed
    console.log('Demo mode - no sign out required');
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