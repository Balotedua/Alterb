import { AnimatePresence, motion } from 'framer-motion';
import { Lock, X } from 'lucide-react';
import { renderIcon } from '@/utils/iconMapper';
import { RARITY_META } from '@/types/gamification';
import type { BadgeDefinition } from '@/types/gamification';

interface BadgeDetailModalProps {
  badge:       BadgeDefinition | null;
  isEarned:    boolean;
  unlockedAt?: string;
  onClose:     () => void;
}

export function BadgeDetailModal({
  badge,
  isEarned,
  unlockedAt,
  onClose,
}: BadgeDetailModalProps) {
  return (
    <AnimatePresence>
      {badge && (
        <>
          {/* Backdrop */}
          <motion.div
            className="badge-modal__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="badge-modal"
            role="dialog"
            aria-modal="true"
            aria-label={badge.name}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          >
            {/* Close button */}
            <button
              className="badge-modal__close"
              onClick={onClose}
              aria-label="Chiudi"
            >
              <X size={16} />
            </button>

            {/* Icon hero */}
            <BadgeIconHero badge={badge} isEarned={isEarned} />

            {/* Content */}
            <div className="badge-modal__content">
              <div className="badge-modal__rarity-label" style={{ color: RARITY_META[badge.rarity].color }}>
                {RARITY_META[badge.rarity].label}
              </div>
              <h2 className="badge-modal__name">{badge.name}</h2>
              <p className="badge-modal__description">{badge.description}</p>

              <div className="badge-modal__meta">
                <div className="badge-modal__meta-item">
                  <span className="badge-modal__meta-label">Ricompensa XP</span>
                  <span
                    className="badge-modal__meta-value"
                    style={{ color: RARITY_META[badge.rarity].color }}
                  >
                    +{badge.xp_reward} XP
                  </span>
                </div>
                <div className="badge-modal__meta-item">
                  <span className="badge-modal__meta-label">Stato</span>
                  <span
                    className="badge-modal__meta-value"
                    style={{
                      color: isEarned ? '#22c55e' : 'var(--text-muted)',
                    }}
                  >
                    {isEarned ? '✓ Sbloccato' : '🔒 Bloccato'}
                  </span>
                </div>
                {isEarned && unlockedAt && (
                  <div className="badge-modal__meta-item">
                    <span className="badge-modal__meta-label">Sbloccato il</span>
                    <span className="badge-modal__meta-value">
                      {new Date(unlockedAt).toLocaleDateString('it-IT', {
                        day:   '2-digit',
                        month: 'long',
                        year:  'numeric',
                      })}
                    </span>
                  </div>
                )}
                {badge.criteria.threshold && (
                  <div className="badge-modal__meta-item">
                    <span className="badge-modal__meta-label">Obiettivo</span>
                    <span className="badge-modal__meta-value">
                      {badge.criteria.threshold} {criteriaLabel(badge.criteria.event_type)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function BadgeIconHero({
  badge,
  isEarned,
}: {
  badge: BadgeDefinition;
  isEarned: boolean;
}) {
  const meta  = RARITY_META[badge.rarity];
  const color = isEarned ? meta.color : 'var(--text-muted)';

  return (
    <div className="badge-modal__icon-hero">
      <motion.div
        className="badge-modal__icon-ring"
        style={
          isEarned
            ? {
                borderColor: `${meta.color}66`,
                boxShadow:   `0 0 40px ${meta.glow}`,
                background:  `${meta.color}11`,
              }
            : undefined
        }
        animate={isEarned ? { boxShadow: [`0 0 20px ${meta.glow}`, `0 0 40px ${meta.glow}`, `0 0 20px ${meta.glow}`] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {isEarned ? (
          renderIcon(badge.icon, { size: 48, strokeWidth: 1.5, color })
        ) : (
          <Lock size={40} strokeWidth={1.5} color="var(--text-muted)" />
        )}
      </motion.div>
    </div>
  );
}

function criteriaLabel(eventType: string): string {
  const labels: Record<string, string> = {
    transaction_added: 'transazioni',
    note_created:      'note',
    mood_logged:       'registrazioni umore',
    activity_logged:   'attività fisiche',
    streak_increment:  'giorni consecutivi',
    section_visited:   'sezioni visitate',
  };
  return labels[eventType] ?? '';
}
