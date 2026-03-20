import { supabase } from '@/config/supabase';

export function useAuth() {
  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const register = async (
    email: string,
    password: string,
    metadata: { first_name: string; last_name: string; full_name: string; avatar_url: null },
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
  };

  return { login, register };
}
