import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBadgeDefinitions, useUserBadges } from '@/hooks/useBadges';
import { BadgeCard } from '@/components/badges/BadgeCard';
import { BadgeDetailModal } from '@/components/badges/BadgeDetailModal';
import type { BadgeDefinition, BadgeRarity } from '@/types/gamification';
import { RARITY_META } from '@/types/gamification';

type FilterTab    = 'all' | 'earned' | 'locked';
type RarityFilter = 'all' | BadgeRarity;

export function BadgeGrid() {
  const { data: definitions = [], isLoading: defsLoading } = useBadgeDefinitions();
  const { data: userBadges  = [], isLoading: ubLoading   } = useUserBadges();

  const [activeTab,    setActiveTab   ] = useState<FilterTab>('all');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [selected,     setSelected    ] = useState<BadgeDefinition | null>(null);

  const earnedIds   = new Set(userBadges.map((ub) => ub.badge_id));
  const earnedCount = earnedIds.size;
  const totalCount  = definitions.length;

  const filtered = definitions.filter((b) => {
    if (activeTab === 'earned' && !earnedIds.has(b.id)) return false;
    if (activeTab === 'locked' &&  earnedIds.has(b.id)) return false;
    if (rarityFilter !== 'all' && b.rarity !== rarityFilter) return false;
    return true;
  });

  const isLoading = defsLoading || ubLoading;

  return (
    <section className="badge-section" aria-label="Lista badge">

      {/* Header: title + completion bar */}
      <div className="badge-section__header">
        <div className="badge-section__title-row">
          <h2 className="badge-section__title">Badge</h2>
          <span className="badge-section__count">
            {earnedCount} / {totalCount} sbloccati
          </span>
        </div>
        <div className="badge-section__bar" role="progressbar"
          aria-valuenow={earnedCount} aria-valuemax={totalCount}>
          <motion.div
            className="badge-section__bar-fill"
            initial={{ width: 0 }}
            animate={{ width: totalCount > 0 ? `${(earnedCount / totalCount) * 100}%` : '0%' }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="badge-filters">
        {/* Status tabs */}
        <div className="badge-filters__tabs" role="tablist">
          {TABS.map(({ key, label }) => (
            <button key={key} role="tab" aria-selected={activeTab === key}
              className={['badge-tab', activeTab === key ? 'badge-tab--active' : ''].join(' ')}
              onClick={() => setActiveTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Rarity chips — scrollable on mobile */}
        <div className="badge-filters__rarity">
          {RARITIES.map(({ key, label, color }) => (
            <button key={key}
              className={['badge-rarity', rarityFilter === key ? 'badge-rarity--active' : ''].join(' ')}
              onClick={() => setRarityFilter(key)}
              style={rarityFilter === key && key !== 'all' ? { borderColor: color, color } : undefined}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <BadgeListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="badge-empty">Nessun badge in questa categoria.</div>
      ) : (
        <motion.div className="badge-list"
          initial="hidden" animate="show"
          key={`${activeTab}-${rarityFilter}`}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
          <AnimatePresence mode="popLayout">
            {filtered.map((badge) => {
              const ub = userBadges.find((u) => u.badge_id === badge.id);
              return (
                <motion.div key={badge.id} layout
                  variants={{
                    hidden: { opacity: 0, x: -12 },
                    show:   { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } },
                  }}>
                  <BadgeCard
                    badge={badge}
                    isEarned={!!ub}
                    unlockedAt={ub?.unlocked_at}
                    onClick={() => setSelected(badge)}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <BadgeDetailModal
        badge={selected}
        isEarned={!!selected && earnedIds.has(selected.id)}
        unlockedAt={selected ? userBadges.find((u) => u.badge_id === selected.id)?.unlocked_at : undefined}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

function BadgeListSkeleton() {
  return (
    <div className="badge-list">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="badge-item badge-item--skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',    label: 'Tutti'      },
  { key: 'earned', label: 'Sbloccati'  },
  { key: 'locked', label: 'Bloccati'   },
];

const RARITIES: { key: RarityFilter; label: string; color: string }[] = [
  { key: 'all',       label: 'Tutti',       color: '' },
  { key: 'common',    label: 'Comune',      color: RARITY_META.common.color    },
  { key: 'rare',      label: 'Raro',        color: RARITY_META.rare.color      },
  { key: 'epic',      label: 'Epico',       color: RARITY_META.epic.color      },
  { key: 'legendary', label: 'Leggendario', color: RARITY_META.legendary.color },
];
