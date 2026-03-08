import { motion } from 'framer-motion';
import { Lock, CheckCircle2 } from 'lucide-react';
import { renderIcon } from '@/utils/iconMapper';
import { RARITY_META } from '@/types/gamification';
import type { BadgeDefinition } from '@/types/gamification';

interface BadgeCardProps {
  badge:       BadgeDefinition;
  isEarned:    boolean;
  unlockedAt?: string;
  onClick:     () => void;
}

export function BadgeCard({ badge, isEarned, unlockedAt, onClick }: BadgeCardProps) {
  const meta  = RARITY_META[badge.rarity];
  const color = isEarned ? meta.color : 'var(--text-muted)';

  return (
    <motion.button
      className={['badge-item', isEarned ? 'badge-item--earned' : 'badge-item--locked'].join(' ')}
      style={isEarned ? ({ '--badge-color': color, '--badge-glow': meta.glow } as React.CSSProperties) : undefined}
      onClick={onClick}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      aria-label={`${badge.name}${isEarned ? ' — sbloccato' : ' — bloccato'}`}
    >
      {/* Icon */}
      <div className="badge-item__icon">
        {isEarned
          ? renderIcon(badge.icon, { size: 22, strokeWidth: 1.5, color })
          : <Lock size={18} strokeWidth={1.5} color="var(--text-muted)" />}
      </div>

      {/* Body */}
      <div className="badge-item__body">
        <div className="badge-item__name-row">
          <span className="badge-item__name">{badge.name}</span>
          <span className="badge-item__rarity-chip" style={{ color, borderColor: `${color}44`, background: `${color}11` }}>
            {meta.label}
          </span>
        </div>

        <p className="badge-item__desc">{badge.description}</p>

        {badge.criteria.threshold && (
          <span className="badge-item__objective">
            Obiettivo: {badge.criteria.threshold} {CRITERIA_LABELS[badge.criteria.event_type] ?? ''}
          </span>
        )}
      </div>

      {/* Right: XP + status */}
      <div className="badge-item__right">
        <span className="badge-item__xp" style={{ color }}>+{badge.xp_reward} XP</span>
        {isEarned ? (
          <span className="badge-item__status badge-item__status--earned">
            <CheckCircle2 size={13} strokeWidth={2} />
            {unlockedAt
              ? new Date(unlockedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
              : 'Sbloccato'}
          </span>
        ) : (
          <span className="badge-item__status badge-item__status--locked">Bloccato</span>
        )}
      </div>
    </motion.button>
  );
}

const CRITERIA_LABELS: Record<string, string> = {
  transaction_added: 'transazioni',
  note_created:      'note create',
  mood_logged:       'umori registrati',
  activity_logged:   'attività fisiche',
  streak_increment:  'giorni consecutivi',
  section_visited:   'sezioni visitate',
};
