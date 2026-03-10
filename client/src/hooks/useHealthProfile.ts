import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import type {
  HealthProfile,
  DailyHealthLog,
  HealthGoal,
  HealthGoalKey,
  LogMetricInput,
} from '@/types/health';
import { DEFAULT_GOALS } from '@/types/health';

const today = () => new Date().toISOString().slice(0, 10);

// ── Query key factories ──────────────────────────────────────────────────────

const K = {
  profile: (uid: string) => ['health', 'profile', uid] as const,
  daily:   (uid: string, date: string) => ['health', 'daily', uid, date] as const,
  goals:   (uid: string) => ['health', 'goals', uid] as const,
};

// ── useHealthProfile ─────────────────────────────────────────────────────────

export function useHealthProfile() {
  const { user } = useAuth();
  return useQuery<HealthProfile | null>({
    queryKey: K.profile(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as HealthProfile | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
}

// ── useUpsertProfile ─────────────────────────────────────────────────────────

type ProfileInput = Omit<Partial<HealthProfile>, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export function useUpsertProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, ProfileInput>({
    mutationFn: async (input) => {
      const { error } = await supabase
        .from('health_profiles')
        .upsert(
          { user_id: user!.id, ...input },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.profile(user?.id ?? '') }),
  });
}

// ── useDailyHealthLogs ───────────────────────────────────────────────────────

export function useDailyHealthLogs(date?: string) {
  const { user } = useAuth();
  const d = date ?? today();
  return useQuery<DailyHealthLog[]>({
    queryKey: K.daily(user?.id ?? '', d),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_health_logs')
        .select('*')
        .eq('user_id', user!.id)
        .eq('date', d);
      if (error) throw error;
      return (data ?? []) as DailyHealthLog[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

// ── useLogMetric ─────────────────────────────────────────────────────────────

export function useLogMetric() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, LogMetricInput>({
    mutationFn: async ({ category, key, amount, date, mode = 'set' }) => {
      const d = date ?? today();
      let finalAmount = amount;

      if (mode === 'add') {
        const { data } = await supabase
          .from('daily_health_logs')
          .select('value')
          .eq('user_id', user!.id)
          .eq('date', d)
          .eq('key', key)
          .maybeSingle();
        const current = (data as { value: { amount: number } } | null)?.value?.amount ?? 0;
        finalAmount = current + amount;
      }

      const { error } = await supabase
        .from('daily_health_logs')
        .upsert(
          {
            user_id: user!.id,
            date: d,
            category,
            key,
            value: { amount: finalAmount },
          },
          { onConflict: 'user_id,date,key' }
        );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      const d = variables.date ?? today();
      qc.invalidateQueries({ queryKey: K.daily(user?.id ?? '', d) });
    },
  });
}

// ── useHealthGoals ───────────────────────────────────────────────────────────

export function useHealthGoals() {
  const { user } = useAuth();
  return useQuery<HealthGoal[]>({
    queryKey: K.goals(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_goals')
        .select('*')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []) as HealthGoal[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

// ── useSetGoal ───────────────────────────────────────────────────────────────

export function useSetGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, { key: HealthGoalKey; amount: number }>({
    mutationFn: async ({ key, amount }) => {
      const { error } = await supabase
        .from('health_goals')
        .upsert(
          { user_id: user!.id, key, value: { amount } },
          { onConflict: 'user_id,key' }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.goals(user?.id ?? '') }),
  });
}

// ── getGoalAmount ────────────────────────────────────────────────────────────

export function getGoalAmount(goals: HealthGoal[], key: HealthGoalKey): number {
  return goals.find((g) => g.key === key)?.value.amount ?? DEFAULT_GOALS[key];
}
