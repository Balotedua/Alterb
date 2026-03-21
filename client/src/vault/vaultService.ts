import { supabase } from '../config/supabase';
import type { VaultEntry } from '../types';

// ─── Write ───────────────────────────────────────────────────
export async function saveEntry(
  userId: string,
  category: string,
  data: Record<string, unknown>
): Promise<VaultEntry | null> {
  const { data: row, error } = await supabase
    .from('vault')
    .insert({ user_id: userId, category, data })
    .select()
    .single();
  if (error) { console.error('[vault save]', error); return null; }
  return row as VaultEntry;
}

// ─── Read: all entries for a category ────────────────────────
export async function getByCategory(
  userId: string,
  category: string,
  limit = 50
): Promise<VaultEntry[]> {
  const { data, error } = await supabase
    .from('vault')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[vault getByCategory]', error); return []; }
  return (data ?? []) as VaultEntry[];
}

// ─── Read: category summary (for starfield) ───────────────────
export interface CategorySummary {
  category: string;
  count: number;
  lastEntry: string;
}

export async function getCategorySummaries(userId: string): Promise<CategorySummary[]> {
  const { data, error } = await supabase
    .from('vault')
    .select('category, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const map = new Map<string, CategorySummary>();
  for (const row of data) {
    const existing = map.get(row.category);
    if (!existing) {
      map.set(row.category, { category: row.category, count: 1, lastEntry: row.created_at });
    } else {
      existing.count++;
    }
  }
  return Array.from(map.values());
}

// ─── Read: recent entries across all categories ──────────────
export async function getRecentAll(userId: string, limit = 30): Promise<VaultEntry[]> {
  const { data, error } = await supabase
    .from('vault')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[vault getRecentAll]', error); return []; }
  return (data ?? []) as VaultEntry[];
}

// ─── Read: calendar events in a date range (JSONB filter) ────
export async function queryCalendarByDate(
  userId: string,
  from: Date,
  to: Date
): Promise<VaultEntry[]> {
  const { data, error } = await supabase
    .from('vault')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'calendar')
    .gte('data->>scheduled_at', from.toISOString())
    .lte('data->>scheduled_at', to.toISOString())
    .order('data->>scheduled_at', { ascending: true });
  if (error) { console.error('[vault queryCalendarByDate]', error); return []; }
  return (data ?? []) as VaultEntry[];
}

// ─── Read: upcoming events (next 30 min) for sentinel ────────
export async function getUpcomingEvents(userId: string): Promise<VaultEntry[]> {
  const now  = new Date();
  const soon = new Date(now.getTime() + 30 * 60 * 1000);
  const { data, error } = await supabase
    .from('vault')
    .select('*')
    .eq('user_id', userId)
    .filter('data->>is_event', 'eq', 'true')
    .gte('data->>scheduled_at', now.toISOString())
    .lte('data->>scheduled_at', soon.toISOString())
    .order('data->>scheduled_at', { ascending: true });
  if (error) { console.error('[vault getUpcomingEvents]', error); return []; }
  return (data ?? []) as VaultEntry[];
}

// ─── Delete ──────────────────────────────────────────────────
export async function deleteEntry(id: string): Promise<boolean> {
  const { error } = await supabase.from('vault').delete().eq('id', id);
  return !error;
}

// ─── Delete: all entries of a category (removes the star) ────
export async function deleteCategory(userId: string, category: string): Promise<boolean> {
  const { error } = await supabase
    .from('vault')
    .delete()
    .eq('user_id', userId)
    .eq('category', category);
  return !error;
}

// ─── Delete: last entry of a category ────────────────────────
export async function deleteLastInCategory(
  userId: string,
  category: string
): Promise<boolean> {
  const { data } = await supabase
    .from('vault')
    .select('id')
    .eq('user_id', userId)
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (!data) return false;
  return deleteEntry(data.id);
}
