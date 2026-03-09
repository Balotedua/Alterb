import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { MoodEntry } from '@/types';
import { NebulaCard, NebulaStat } from '@/components/ui/nebula';

interface Props {
  params: Record<string, unknown>;
}

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
const MOOD_LABEL: Record<number, string> = { 1: 'Pessimo', 2: 'Basso', 3: 'Neutro', 4: 'Buono', 5: 'Eccellente' };

function useMoodEntries(limit: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['mood_entries', user?.id, limit],
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

export function PsychOverviewFragment({ params }: Props) {
  const days = typeof params.days === 'number' ? params.days : 5;
  const { data: entries } = useMoodEntries(days);
  const last = entries?.[0];

  const avg = entries?.length
    ? (entries.reduce((s, e) => s + e.mood, 0) / entries.length).toFixed(1)
    : null;

  return (
    <NebulaCard icon="🧠" title="Psicologia · umore">
      {last ? (
        <>
          <div className="fragment-kpis">
            <NebulaStat
              label="Umore attuale"
              value={MOOD_EMOJI[last.mood]}
              sub={MOOD_LABEL[last.mood]}
            />
            {avg && (
              <NebulaStat
                label={`Media (${days} giorni)`}
                value={`${avg} / 5`}
                color={parseFloat(avg) >= 3.5 ? 'green' : parseFloat(avg) < 2.5 ? 'red' : 'neutral'}
              />
            )}
          </div>
          {last.note && <div className="fragment-note">"{last.note}"</div>}
        </>
      ) : (
        <p className="fragment-empty">Nessun dato sull'umore ancora.</p>
      )}
    </NebulaCard>
  );
}
