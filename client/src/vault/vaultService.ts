import { supabase } from '../config/supabase';
import type { VaultEntry, SemanticLink } from '../types';
import { generateVec, cosineSim } from '../core/semanticVec';

// ─── Write ───────────────────────────────────────────────────
export async function saveEntry(
  userId: string,
  category: string,
  data: Record<string, unknown>
): Promise<VaultEntry | null> {
  const vec = generateVec(category, data);
  const dataWithVec = { ...data, _embedding: vec };
  const embedding = `[${vec.join(',')}]`;
  const { data: row, error } = await supabase
    .from('vault')
    .insert({ user_id: userId, category, data: dataWithVec, embedding })
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

// ─── Semantic clustering ──────────────────────────────────────
// Averages embeddings per category → cosine similarity between centroids
export async function getSemanticLinks(userId: string): Promise<SemanticLink[]> {
  const { data, error } = await supabase
    .from('vault')
    .select('category, data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];

  const centroids = new Map<string, { sum: number[]; count: number }>();
  for (const row of data) {
    const emb = (row.data as Record<string, unknown>)._embedding as number[] | undefined;
    if (!emb || emb.length === 0) continue;
    const existing = centroids.get(row.category);
    if (!existing) {
      centroids.set(row.category, { sum: [...emb], count: 1 });
    } else {
      for (let i = 0; i < emb.length; i++) existing.sum[i] += emb[i];
      existing.count++;
    }
  }

  const cats = Array.from(centroids.entries()).map(([cat, { sum, count }]) => ({
    cat,
    vec: sum.map(v => v / count),
  }));

  const links: SemanticLink[] = [];
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      const sim = cosineSim(cats[i].vec, cats[j].vec);
      if (sim > 0.55) links.push({ catA: cats[i].cat, catB: cats[j].cat, similarity: sim });
    }
  }
  return links.sort((a, b) => b.similarity - a.similarity);
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

// ─── Chat sessions (stored in vault category='chat') ─────────
export async function saveChatSession(
  userId: string,
  title: string,
  messages: { role: string; text: string; ts: number }[]
): Promise<VaultEntry | null> {
  const { data: row, error } = await supabase
    .from('vault')
    .insert({ user_id: userId, category: 'chat', data: { title, messages } })
    .select()
    .single();
  if (error) { console.error('[chat save]', error); return null; }
  return row as VaultEntry;
}

export async function updateChatSession(
  sessionId: string,
  title: string,
  messages: { role: string; text: string; ts: number }[]
): Promise<void> {
  await supabase.from('vault').update({ data: { title, messages } }).eq('id', sessionId);
}

export async function getChatSessions(userId: string): Promise<VaultEntry[]> {
  return getByCategory(userId, 'chat', 50);
}

// ─── Documents: get by docType ───────────────────────────────
export async function getDocumentsByType(userId: string, docType: string): Promise<VaultEntry[]> {
  const { data, error } = await supabase
    .from('vault')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'documents')
    .eq('data->>docType', docType)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []) as VaultEntry[];
}

// ─── Documents: full-text search in extractedText ────────────
// Uses the GIN tsvector index (documents_search_index.sql) for speed
export async function searchDocuments(userId: string, keyword: string): Promise<VaultEntry[]> {
  // Build a websearch-compatible tsquery from the keyword
  const tsquery = keyword.trim().split(/\s+/).join(' & ');
  const { data, error } = await supabase
    .from('vault')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'documents')
    .textSearch('data->>extractedText', tsquery, { config: 'italian' })
    .order('created_at', { ascending: false })
    .limit(10);
  // Fallback to ilike if tsvector index not yet installed
  if (error) {
    const { data: d2 } = await supabase
      .from('vault')
      .select('*')
      .eq('user_id', userId)
      .eq('category', 'documents')
      .ilike('data->>extractedText', `%${keyword}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    return (d2 ?? []) as VaultEntry[];
  }
  return (data ?? []) as VaultEntry[];
}

// ─── Admin: global stats (no user_id filter) ─────────────────
export interface AdminStats {
  totalEntries: number;
  byCategory: { category: string; count: number }[];
  aiCalls: number;
  aiTokensIn: number;
  aiTokensOut: number;
  estimatedCostUSD: number;
  totalSizeMB: number;
}

export interface ActiveUser {
  userId: string;
  lastActivity: string;
  entryCount: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase
    .from('vault')
    .select('category, created_at, data')
    .order('created_at', { ascending: false });

  if (error || !data) return { totalEntries: 0, byCategory: [], aiCalls: 0, aiTokensIn: 0, aiTokensOut: 0, estimatedCostUSD: 0, totalSizeMB: 0 };

  const map = new Map<string, number>();
  let totalBytes = 0;
  for (const row of data) {
    map.set(row.category, (map.get(row.category) ?? 0) + 1);
    totalBytes += new Blob([JSON.stringify(row.data ?? {})]).size;
  }
  const byCategory = Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const aiCalls     = parseInt(localStorage.getItem('_alter_ai_calls')     ?? '0', 10);
  const aiTokensIn  = parseInt(localStorage.getItem('_alter_ai_tokens_in')  ?? '0', 10);
  const aiTokensOut = parseInt(localStorage.getItem('_alter_ai_tokens_out') ?? '0', 10);
  // DeepSeek-chat pricing: $0.14/M input, $0.28/M output
  const estimatedCostUSD = (aiTokensIn / 1_000_000) * 0.14 + (aiTokensOut / 1_000_000) * 0.28;
  const totalSizeMB = totalBytes / (1024 * 1024);
  return { totalEntries: data.length, byCategory, aiCalls, aiTokensIn, aiTokensOut, estimatedCostUSD, totalSizeMB };
}

export async function getLastActiveUsers(): Promise<ActiveUser[]> {
  const { data, error } = await supabase
    .from('vault')
    .select('user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !data) return [];

  const map = new Map<string, { lastActivity: string; count: number }>();
  for (const row of data) {
    const existing = map.get(row.user_id);
    if (!existing) {
      map.set(row.user_id, { lastActivity: row.created_at, count: 1 });
    } else {
      existing.count++;
    }
  }
  return Array.from(map.entries())
    .map(([userId, v]) => ({ userId, lastActivity: v.lastActivity, entryCount: v.count }))
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
    .slice(0, 20);
}

// ─── Delete: all data for a user (full reset) ────────────────
export async function deleteAllUserData(userId: string): Promise<boolean> {
  const { error } = await supabase.from('vault').delete().eq('user_id', userId);
  return !error;
}

// ─── Delete: entries in a category within a date range ───────
export async function deleteByCategoryAndDateRange(
  userId: string,
  category: string,
  from: Date,
  to: Date
): Promise<number> {
  const { data, error } = await supabase
    .from('vault')
    .select('id')
    .eq('user_id', userId)
    .eq('category', category)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString());
  if (error || !data || data.length === 0) return 0;
  const ids = data.map(r => r.id);
  const { error: delErr } = await supabase.from('vault').delete().in('id', ids);
  return delErr ? 0 : ids.length;
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
