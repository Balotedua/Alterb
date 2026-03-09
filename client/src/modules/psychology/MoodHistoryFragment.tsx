import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { MoodEntry } from '@/types';
import { NebulaCard, NebulaGraph } from '@/components/ui/nebula';

interface Props {
  params: Record<string, unknown>;
}

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

function useMoodHistory(limit: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['mood_history', user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_entries')
        .select('id, mood, note, date, created_at')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as MoodEntry[];
    },
    enabled: !!user,
  });
}

export function MoodHistoryFragment({ params }: Props) {
  const limit = typeof params.limit === 'number' ? params.limit : 7;
  const { data: entries } = useMoodHistory(limit);

  const chartData = [...(entries ?? [])].reverse().map((e) => e.mood);

  return (
    <NebulaCard icon="📊" title={`Storico umore · ultimi ${limit} giorni`}>
      <NebulaGraph data={chartData} color="#a78bfa" height={48} label="umore (1-5)" />
      {entries && entries.length > 0 ? (
        <div className="fragment-list" style={{ marginTop: '0.6rem' }}>
          {entries.slice(0, 5).map((e) => (
            <div key={e.id} className="fragment-list-row">
              <span className="fragment-list-desc">{e.date}</span>
              <span className="fragment-list-amt">{MOOD_EMOJI[e.mood]} {e.mood}/5</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="fragment-empty">Nessun dato sul mood disponibile.</p>
      )}
    </NebulaCard>
  );
}
