import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/services/supabase';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = (session?.user as User) ?? null;
      setUser(u);
      setLoading(false);
      if (u) {
        supabase.rpc('update_last_seen').then(({ error }) => {
          if (error) console.warn('[Nebula] update_last_seen:', error.message);
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = (session?.user as User) ?? null;
      setUser(u);
      if (u) {
        supabase.rpc('update_last_seen').then(({ error }) => {
          if (error) console.warn('[Nebula] update_last_seen:', error.message);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const register = async (
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
