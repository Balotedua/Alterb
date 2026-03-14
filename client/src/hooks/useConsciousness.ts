import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Entry, Tag, ConsciousnessReport } from '@/types/index';

const K = {
  entries: (uid: string) => ['entries', uid] as const,
  tags:    (uid: string) => ['tags', uid] as const,
  report:  (uid: string) => ['c_report', uid] as const,
};

// ── Entries (all, enriched with tags) ────────────────────────────────────────

async function enrichWithTags(userId: string, rows: Entry[]): Promise<Entry[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const { data } = await supabase
    .from('entry_tags')
    .select('entry_id, tags(id, tag_name)')
    .in('entry_id', ids);

  const map: Record<string, Tag[]> = {};
  (data ?? []).forEach((r: { entry_id: string; tags: unknown }) => {
    if (!map[r.entry_id]) map[r.entry_id] = [];
    if (r.tags) map[r.entry_id].push(r.tags as Tag);
  });

  return rows.map((e) => ({ ...e, tags: map[e.id] ?? [] }));
}

export function useEntries() {
  const { user } = useAuth();
  return useQuery({
    queryKey: K.entries(user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<Entry[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('entries')
        .select('id, user_id, raw_text, clean_text, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return enrichWithTags(user.id, (data as Entry[]) ?? []);
    },
  });
}

// ── Tags with count ───────────────────────────────────────────────────────────

export function useTags() {
  const { user } = useAuth();
  return useQuery({
    queryKey: K.tags(user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<(Tag & { entry_count: number })[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('tags_with_count')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_count', { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Tag & { entry_count: number })[];
    },
  });
}

// ── Add entry (post-AI tagging) ───────────────────────────────────────────────

export function useAddEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rawText,
      tagResult,
    }: {
      rawText: string;
      tagResult: { tags: string[]; clean_text: string };
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data: entry, error: entryErr } = await supabase
        .from('entries')
        .insert({ user_id: user.id, raw_text: rawText, clean_text: tagResult.clean_text })
        .select('id')
        .single();
      if (entryErr) throw entryErr;

      const tagIds: string[] = [];
      for (const tagName of tagResult.tags) {
        const { data: existing } = await supabase
          .from('tags')
          .select('id')
          .eq('user_id', user.id)
          .eq('tag_name', tagName)
          .maybeSingle();

        if (existing) {
          tagIds.push(existing.id as string);
        } else {
          const { data: newTag, error: tagErr } = await supabase
            .from('tags')
            .insert({ user_id: user.id, tag_name: tagName })
            .select('id')
            .single();
          if (tagErr) throw tagErr;
          tagIds.push(newTag.id as string);
        }
      }

      if (tagIds.length > 0) {
        const { error: pivotErr } = await supabase
          .from('entry_tags')
          .insert(tagIds.map((tid) => ({ entry_id: entry.id, tag_id: tid })));
        if (pivotErr) throw pivotErr;
      }

      return { entryId: entry.id, tags: tagResult.tags };
    },
    onSuccess: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: K.entries(user.id) });
      qc.invalidateQueries({ queryKey: K.tags(user.id) });
    },
  });
}

// ── Latest weekly report ──────────────────────────────────────────────────────

export function useLatestReport() {
  const { user } = useAuth();
  return useQuery({
    queryKey: K.report(user?.id ?? ''),
    enabled: !!user,
    queryFn: async (): Promise<ConsciousnessReport | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('consciousness_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as ConsciousnessReport) ?? null;
    },
  });
}

export function useDeleteEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('entries').delete().eq('id', entryId).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: K.entries(user.id) });
      qc.invalidateQueries({ queryKey: K.tags(user.id) });
    },
  });
}

export function useDeleteReport() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('consciousness_reports')
        .delete()
        .eq('id', reportId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: K.report(user.id) });
    },
  });
}

export function useDeleteTag() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('tags').delete().eq('id', tagId).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: K.tags(user.id) });
    },
  });
}

export function useSaveReport() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, weekStart }: { content: string; weekStart: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('consciousness_reports')
        .upsert(
          { user_id: user.id, content, week_start: weekStart },
          { onConflict: 'user_id,week_start' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: K.report(user.id) });
    },
  });
}
