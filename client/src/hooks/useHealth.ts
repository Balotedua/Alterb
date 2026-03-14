import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { BodyVital, ExerciseMax, ExerciseUnit, SleepEntry, WorkoutSession } from '@/types';

// ── Query key factories ──────────────────────────────────────────────────────

const K = {
  vitals:    (uid: string) => ['health', 'vitals',    uid] as const,
  exercises: (uid: string) => ['health', 'exercises', uid] as const,
  sleep:     (uid: string) => ['health', 'sleep',     uid] as const,
  water:     (uid: string) => ['health', 'water',     uid] as const,
};

// ── Body Vitals ──────────────────────────────────────────────────────────────

export function useBodyVitals() {
  const { user } = useAuth();
  return useQuery<BodyVital[]>({
    queryKey: K.vitals(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_vitals')
        .select('id, weight_kg, height_cm, date')
        .eq('user_id', user!.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BodyVital[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

export interface AddVitalInput {
  weight_kg?: number;
  height_cm?: number;
  date: string;
}

export function useAddVital() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, AddVitalInput>({
    mutationFn: async (input) => {
      const { error } = await supabase
        .from('body_vitals')
        .insert({ user_id: user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.vitals(user?.id ?? '') }),
  });
}

export function useDeleteVital() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('body_vitals')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.vitals(user?.id ?? '') }),
  });
}

// ── Exercise Maxes ───────────────────────────────────────────────────────────

export interface ExerciseMaxInput {
  exercise: string;
  value: number;
  unit: ExerciseUnit;
}

export function useExerciseMaxes() {
  const { user } = useAuth();
  return useQuery<ExerciseMax[]>({
    queryKey: K.exercises(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_maxes')
        .select('id, exercise, value, unit, date')
        .eq('user_id', user!.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExerciseMax[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

export function useAddExerciseMax() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, ExerciseMaxInput>({
    mutationFn: async (input) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from('exercise_maxes')
        .insert({ user_id: user!.id, date: today, ...input });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.exercises(user?.id ?? '') }),
  });
}

export function useUpdateExerciseMax() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; value: number }>({
    mutationFn: async ({ id, value }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from('exercise_maxes')
        .update({ value: Math.max(0, value), date: today })
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.exercises(user?.id ?? '') }),
  });
}

export function useDeleteExerciseMax() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('exercise_maxes')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.exercises(user?.id ?? '') }),
  });
}

/** Ritorna l'ultimo record per ogni esercizio distinto */
export function latestByExercise(maxes: ExerciseMax[]): ExerciseMax[] {
  const map = new Map<string, ExerciseMax>();
  for (const m of maxes) {
    const existing = map.get(m.exercise);
    if (!existing || new Date(m.date) > new Date(existing.date)) {
      map.set(m.exercise, m);
    }
  }
  return Array.from(map.values());
}

// ── Workout Sessions ─────────────────────────────────────────────────────────

export interface AddWorkoutSessionInput {
  date: string;
  muscles: string[];
  rpe?: number;
  duration_m?: number;
  notes?: string;
}

export function useWorkoutSessions() {
  const { user } = useAuth();
  return useQuery<WorkoutSession[]>({
    queryKey: ['health', 'workout_sessions', user?.id ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, date, rpe, duration_m, notes, muscles')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .limit(180);
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, muscles: r.muscles ?? [] })) as WorkoutSession[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

export function useAddWorkoutSession() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, AddWorkoutSessionInput>({
    mutationFn: async (input) => {
      const { error } = await supabase
        .from('workout_sessions')
        .insert({ user_id: user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health', 'workout_sessions', user?.id ?? ''] }),
  });
}

// ── Sleep Entries ────────────────────────────────────────────────────────────

export interface AddSleepInput {
  duration_minutes: number;
  quality: 1 | 2 | 3 | 4 | 5;
  date: string;
}

export function useSleepEntries() {
  const { user } = useAuth();
  return useQuery<SleepEntry[]>({
    queryKey: K.sleep(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sleep_entries')
        .select('id, duration_minutes, quality, date')
        .eq('user_id', user!.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SleepEntry[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

export function useAddSleepEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, AddSleepInput>({
    mutationFn: async (input) => {
      const { error } = await supabase
        .from('sleep_entries')
        .insert({ user_id: user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.sleep(user?.id ?? '') }),
  });
}

export function useDeleteSleepEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('sleep_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.sleep(user?.id ?? '') }),
  });
}

// ── Custom Exercises ─────────────────────────────────────────────────────────

export interface CustomExercise {
  id: string;
  name: string;
  muscle_group: string;
  unit: ExerciseUnit;
}

export interface AddCustomExerciseInput {
  name: string;
  muscle_group: string;
  unit: ExerciseUnit;
}

export function useCustomExercises() {
  const { user } = useAuth();
  return useQuery<CustomExercise[]>({
    queryKey: ['health', 'custom_exercises', user?.id ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_exercises')
        .select('id, name, muscle_group, unit')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomExercise[];
    },
    enabled: !!user?.id,
    staleTime: 120_000,
  });
}

export function useAddCustomExercise() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, AddCustomExerciseInput>({
    mutationFn: async (input) => {
      const { error } = await supabase
        .from('custom_exercises')
        .insert({ user_id: user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health', 'custom_exercises', user?.id ?? ''] }),
  });
}

// ── Water Log ────────────────────────────────────────────────────────────────

export const WATER_GOAL = 8;

export interface WaterRow {
  id: string;
  date: string;
  glasses: number;
}

export function useWaterLog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const query = useQuery<WaterRow[]>({
    queryKey: K.water(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('water_log')
        .select('id, date, glasses')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as WaterRow[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const todayGlasses = query.data?.find((r) => r.date === today)?.glasses ?? 0;

  const upsertGlasses = useMutation<void, Error, { date: string; glasses: number }>({
    mutationFn: async ({ date, glasses }) => {
      const { error } = await supabase
        .from('water_log')
        .upsert(
          { user_id: user!.id, date, glasses: Math.max(0, Math.min(20, glasses)) },
          { onConflict: 'user_id,date' }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.water(user?.id ?? '') }),
  });

  const addGlass    = () => upsertGlasses.mutate({ date: today, glasses: todayGlasses + 1 });
  const removeGlass = () => upsertGlasses.mutate({ date: today, glasses: todayGlasses - 1 });

  return {
    ...query,
    todayGlasses,
    addGlass,
    removeGlass,
  };
}
