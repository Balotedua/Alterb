import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { UserGamification } from '@/types/gamification';

const FALLBACK: Omit<UserGamification, 'user_id'> = {
  xp:          0,
  level:       1,
  streak:      0,
  last_active: null,
  updated_at:  new Date().toISOString(),
};

export function useGamification() {
  const { user } = useAuth();

  return useQuery<UserGamification>({
    queryKey: ['user-gamification', user?.id],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      // PGRST116 = "no rows returned" — user hasn't played yet
      if (error && error.code !== 'PGRST116') throw error;

      return data ?? { user_id: user!.id, ...FALLBACK };
    },
    enabled:   !!user?.id,
    staleTime: 30_000, // 30s — re-fetch after badge events invalidate
  });
}
