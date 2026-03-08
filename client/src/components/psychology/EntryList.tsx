import { MOOD_CONFIG } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import type { MoodEntry } from '@/types';

interface EntryListProps {
  entries?: MoodEntry[];
}

export function EntryList({ entries = [] }: EntryListProps) {
  if (entries.length === 0) {
    return <p className="empty-state">Nessuna entry registrata.</p>;
  }

  return (
    <ul className="entry-list">
      {entries.map((entry) => {
        const moodCfg = MOOD_CONFIG.find((m) => m.id === entry.mood);
        return (
          <li key={entry.id} className="entry-item">
            <span className="entry-item__emoji">{moodCfg?.emoji ?? '❓'}</span>
            <span className="entry-item__label">{moodCfg?.label ?? String(entry.mood)}</span>
            <span className="entry-item__date">{formatDate(entry.date)}</span>
            {entry.note ? <p className="entry-item__note">{entry.note}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
