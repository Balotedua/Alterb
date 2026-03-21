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
