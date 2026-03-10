import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Note } from '@/types';

const fragmentAnim = {
  initial:    { opacity: 0, scale: 0.93, y: 16 },
  animate:    { opacity: 1, scale: 1,    y: 0   },
  exit:       { opacity: 0, scale: 0.96, y: 10  },
  transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

function useRecentNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notes_recent', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, content, tags, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!user,
  });
}

export function ConsciousnessFragment() {
  const { data: notes } = useRecentNotes();

  return (
    <motion.div className="fragment" {...fragmentAnim}>
      <div className="fragment-header">
        <span className="fragment-icon">✦</span>
        <span className="fragment-title">Riflessioni</span>
      </div>

      {notes && notes.length > 0 ? (
        <div className="fragment-list">
          {notes.map((n) => (
            <div key={n.id} className="fragment-list-row fragment-list-row--note">
              <span className="fragment-list-desc">{n.title}</span>
              <span className="fragment-list-sub">
                {new Date(n.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="fragment-empty">Nessuna nota ancora. Inizia a scrivere i tuoi pensieri.</p>
      )}
    </motion.div>
  );
}
