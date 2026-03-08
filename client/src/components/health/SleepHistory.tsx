import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Trash2 } from 'lucide-react';
import type { SleepEntry } from '@/types';

interface SleepHistoryProps {
  entries: SleepEntry[];
  onRemove: (id: string) => void;
}

const QUALITY_EMOJI = ['', '😴', '😞', '😐', '😊', '🌟'] as const;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function SleepHistory({ entries, onRemove }: SleepHistoryProps) {
  return (
    <motion.div
      className="h-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
    >
      <div className="h-card-header">
        <div className="h-card-header-left">
          <Moon size={16} className="h-card-icon" />
          <span className="h-card-title">Storico Sonno</span>
        </div>
        <span className="h-card-meta">{entries.length} registrazioni</span>
      </div>

      {entries.length === 0 && (
        <p className="h-empty-hint">Nessuna registrazione. Usa il Log Rapido per aggiungere.</p>
      )}

      <div className="h-sleep-section">
        <AnimatePresence>
          {entries.slice(0, 10).map((e, i) => (
            <motion.div
              key={e.id}
              className="h-sleep-item"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, height: 0, marginBottom: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <span style={{ fontSize: '1.3rem' }}>{QUALITY_EMOJI[e.quality]}</span>
              <div className="h-sleep-item__meta">
                <span className="h-sleep-item__date">{e.date}</span>
                <span className="h-sleep-item__hours">{formatDuration(e.duration_minutes)}</span>
              </div>
              <div className="h-stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} style={{ fontSize: '0.7rem', color: s <= e.quality ? '#f59e0b' : 'var(--border)' }}>
                    ★
                  </span>
                ))}
              </div>
              <button
                className="h-sleep-item__del"
                onClick={() => onRemove(e.id)}
                aria-label="Rimuovi"
              >
                <Trash2 size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
