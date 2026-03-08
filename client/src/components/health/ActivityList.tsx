import { ACT_CONFIG } from '@/utils/constants';
import { formatDate, formatDuration } from '@/utils/formatters';
import type { Activity } from '@/types';

interface ActivityListProps {
  activities?: Activity[];
}

export function ActivityList({ activities = [] }: ActivityListProps) {
  if (activities.length === 0) {
    return <p className="empty-state">Nessuna attività registrata.</p>;
  }

  return (
    <ul className="activity-list">
      {activities.map((a) => {
        const cfg = ACT_CONFIG.find((c) => c.id === a.type);
        return (
          <li key={a.id} className="activity-item">
            <span className="activity-item__icon">{cfg?.icon ?? '⚡'}</span>
            <span className="activity-item__label">{cfg?.label ?? a.type}</span>
            <span className="activity-item__duration">{formatDuration(a.duration_minutes)}</span>
            <span className="activity-item__date">{formatDate(a.date)}</span>
          </li>
        );
      })}
    </ul>
  );
}
