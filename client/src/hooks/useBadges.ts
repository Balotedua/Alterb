import { useEffect, createElement } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { BadgeUnlockToast } from '@/components/badges/BadgeUnlockToast';
import type { BadgeDefinition, UserBadge } from '@/types/gamification';

// ─── Badge Definitions (global, cached 10 min) ───────────────────────────────

export function useBadgeDefinitions() {
  return useQuery<BadgeDefinition[]>({
    queryKey: ['badge-definitions'],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('badge_definitions')
        .select('*')
        .order('rarity');

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60_000,
  });
}

// ─── User Badges + Realtime ───────────────────────────────────────────────────

export function useUserBadges() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<UserBadge[]>({
    queryKey: ['user-badges', user?.id],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('*, badge_definitions(*)')
        .eq('user_id', user!.id)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled:   !!user?.id,
    staleTime: 60_000,
  });

  // ── Realtime subscription: listen for new badge unlocks ──
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user_badges_${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'user_badges',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const badgeId = (payload.new as { badge_id: string }).badge_id;

          // Fetch full badge definition for the toast
          const { data: def } = await supabase
            .from('badge_definitions')
            .select('*')
            .eq('id', badgeId)
            .single();

          // Invalidate queries so UI refreshes
          await qc.invalidateQueries({ queryKey: ['user-badges', user.id] });
          await qc.invalidateQueries({ queryKey: ['user-gamification', user.id] });

          // Show unlock toast (createElement avoids JSX in .ts file)
          if (def) {
            toast.custom(
              (t) => createElement(BadgeUnlockToast, { badge: def as BadgeDefinition, toastId: t }),
              { duration: 6000, position: 'top-right' },
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return query;
}

