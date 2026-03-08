import { BADGES } from '@/utils/constants';
import type { Badge } from '@/types';

interface BadgeGridProps {
  earned?: string[];
}

export function BadgeGrid({ earned = [] }: BadgeGridProps) {
  return (
    <div className="badge-grid">
      {BADGES.map((badge: Badge) => {
        const isEarned = earned.includes(badge.id);
        return (
          <div
            key={badge.id}
            className={['badge-card', isEarned ? 'badge-card--earned' : 'badge-card--locked'].join(' ')}
            title={badge.description}
          >
            <span className="badge-card__icon" aria-hidden="true">
              {badge.icon}
            </span>
            <span className="badge-card__label">{badge.label}</span>
            {!isEarned ? <span className="badge-card__lock">🔒</span> : null}
          </div>
        );
      })}
    </div>
  );
}
