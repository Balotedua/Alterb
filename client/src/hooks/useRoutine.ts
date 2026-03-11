import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoutineFrequency = 'daily' | 'weekly' | 'monthly';
export type RoutineColor     = 'violet' | 'teal' | 'amber' | 'red' | 'blue';

export interface Routine {
  id:           string;
  user_id:      string;
  title:        string;
  description:  string | null;
  time_of_day:  string | null;   // "HH:MM:SS"
  frequency:    RoutineFrequency;
  days_of_week: number[];        // [1,3,5] = Mon, Wed, Fri
  day_of_month: number | null;
  color:        RoutineColor;
  is_active:    boolean;
  created_at:   string;
}

export interface RoutineCompletion {
  id:             string;
  routine_id:     string;
  scheduled_date: string;        // "YYYY-MM-DD"
  completed_at:   string;
}

export interface Appointment {
  id:               string;
  user_id:          string;
  title:            string;
  description:      string | null;
  location:         string | null;
  appointment_date: string;      // "YYYY-MM-DD"
  appointment_time: string | null; // "HH:MM:SS"
  is_done:          boolean;
  color:            RoutineColor;
  created_at:       string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" for today */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns true if a routine applies on the given date */
export function routineAppliesOn(r: Routine, dateStr: string): boolean {
  if (!r.is_active) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay(); // 0 = Sun

  if (r.frequency === 'daily') return true;
  if (r.frequency === 'weekly')
    return Array.isArray(r.days_of_week) && r.days_of_week.includes(dow);
  if (r.frequency === 'monthly')
    return r.day_of_month === d.getDate();
  return false;
}

// ── Keys ─────────────────────────────────────────────────────────────────────

const ROUTINES_KEY      = ['routines'];
const COMPLETIONS_KEY   = (date: string) => ['routine_completions', date];
const APPOINTMENTS_KEY  = ['appointments'];

// ── Routine hooks ─────────────────────────────────────────────────────────────

export function useRoutines() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ROUTINES_KEY,
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('time_of_day', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Routine[];
    },
    enabled: !!user,
  });
}

export function useTodayCompletions() {
  const { user } = useAuth();
  const d = today();
  return useQuery({
    queryKey: COMPLETIONS_KEY(d),
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('routine_completions')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', d);
      if (error) throw error;
      return (data ?? []) as RoutineCompletion[];
    },
    enabled: !!user,
  });
}

export function useAddRoutine() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<Routine, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('routines')
        .insert({ ...input, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ROUTINES_KEY }),
  });
}

export function useDeleteRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ROUTINES_KEY }),
  });
}

export function useToggleCompletion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ routineId, completed }: { routineId: string; completed: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const d = today();
      if (completed) {
        const { error } = await supabase.from('routine_completions').insert({
          routine_id:     routineId,
          user_id:        user.id,
          scheduled_date: d,
        });
        if (error && error.code !== '23505') throw error; // ignore duplicate
      } else {
        const { error } = await supabase
          .from('routine_completions')
          .delete()
          .eq('routine_id', routineId)
          .eq('scheduled_date', d);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPLETIONS_KEY(today()) }),
  });
}

// ── Appointment hooks ─────────────────────────────────────────────────────────

export function useAppointments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: APPOINTMENTS_KEY,
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.id)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
    enabled: !!user,
  });
}

export function useAddAppointment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<Appointment, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('appointments')
        .insert({ ...input, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: APPOINTMENTS_KEY }),
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: APPOINTMENTS_KEY }),
  });
}

export function useToggleAppointmentDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ is_done })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: APPOINTMENTS_KEY }),
  });
}
