import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { MoodEntry } from '@/types';

const fragmentAnim = {
  initial:    { opacity: 0, scale: 0.93, y: 16 },
  animate:    { opacity: 1, scale: 1,    y: 0   },
  exit:       { opacity: 0, scale: 0.96, y: 10  },
  transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
const MOOD_LABEL: Record<number, string> = { 1: 'Pessimo', 2: 'Basso', 3: 'Neutro', 4: 'Buono', 5: 'Eccellente' };

function useMoodEntries() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['mood_entries', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_entries')
        .select('id, mood, note, date, created_at')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as MoodEntry[];
    },
    enabled: !!user,
  });
}

export function PsychologyFragment() {
  const { data: entries } = useMoodEntries();
  const last = entries?.[0];

  const avgMood = entries && entries.length > 0
    ? (entries.reduce((s, e) => s + e.mood, 0) / entries.length).toFixed(1)
    : null;

  return (
    <motion.div className="fragment" {...fragmentAnim}>
      <div className="fragment-header">
        <span className="fragment-icon">🧠</span>
        <span className="fragment-title">Psicologia</span>
      </div>

      {last ? (
        <div className="fragment-kpis">
          <div className="fragment-kpi">
            <span className="fragment-kpi-label">Umore ora</span>
            <span className="fragment-kpi-value" style={{ fontSize: '2rem' }}>
              {MOOD_EMOJI[last.mood]}
            </span>
            <span className="fragment-kpi-sub">{MOOD_LABEL[last.mood]}</span>
          </div>
          {avgMood && (
            <div className="fragment-kpi">
              <span className="fragment-kpi-label">Media (5 giorni)</span>
              <span className="fragment-kpi-value">{avgMood} / 5</span>
            </div>
          )}
        </div>
      ) : (
        <p className="fragment-empty">Nessun dato sull'umore ancora.</p>
      )}

      {last?.note && (
        <div className="fragment-note">"{last.note}"</div>
      )}
    </motion.div>
  );
}
