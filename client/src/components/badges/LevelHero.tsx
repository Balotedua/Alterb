import { motion } from 'framer-motion';
import { Flame, Trophy, Zap } from 'lucide-react';
import { useGamification } from '@/hooks/useGamification';
import { XP_TABLE, LEVEL_RANKS } from '@/utils/constants';

function calcProgress(xp: number, level: number): number {
  const cur  = XP_TABLE[level - 1] ?? 0;
  const next = XP_TABLE[level]     ?? XP_TABLE[XP_TABLE.length - 1];
  if (next <= cur) return 100;
  return Math.min(100, ((xp - cur) / (next - cur)) * 100);
}

export function LevelHero() {
  const { data: gami, isLoading } = useGamification();

  if (isLoading) return <div className="level-hero level-hero--skeleton" aria-busy="true" />;

  const xp       = gami?.xp     ?? 0;
  const level    = gami?.level  ?? 1;
  const streak   = gami?.streak ?? 0;
  const rank     = LEVEL_RANKS[level - 1];
  const progress = calcProgress(xp, level);
  const nextXP   = XP_TABLE[level] ?? XP_TABLE[XP_TABLE.length - 1];
  const curXP    = XP_TABLE[level - 1] ?? 0;

  return (
    <motion.div
      className="level-hero"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Left: avatar + level badge */}
      <div className="level-hero__avatar-wrap">
        <div className="level-hero__avatar">
          <Trophy size={28} strokeWidth={1.5} />
        </div>
        <span className="level-hero__level-badge">Lv.{level}</span>
      </div>

      {/* Center: rank + XP bar */}
      <div className="level-hero__center">
        <div className="level-hero__rank-row">
          <span className="level-hero__rank">{rank?.rank ?? 'Novizio'}</span>
          <span className="level-hero__rank-title">{rank?.title ?? ''}</span>
        </div>

        <div className="level-hero__bar-wrap">
          <div
            className="level-hero__bar"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${xp} XP — Livello ${level}`}
          >
            <motion.div
              className="level-hero__bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
          </div>
          <div className="level-hero__xp-labels">
            <span>{xp - curXP} XP</span>
            <span>{nextXP - curXP} XP</span>
          </div>
        </div>
      </div>

      {/* Right: stats */}
      <div className="level-hero__stats">
        <div className="level-hero__stat">
          <Zap size={14} className="level-hero__stat-icon level-hero__stat-icon--xp" />
          <span className="level-hero__stat-value">{xp}</span>
          <span className="level-hero__stat-label">XP Totale</span>
        </div>
        <div className="level-hero__stat level-hero__stat--streak">
          <Flame
            size={14}
            className={[
              'level-hero__stat-icon',
              streak > 0 ? 'level-hero__stat-icon--streak' : '',
            ].join(' ')}
          />
          <span className="level-hero__stat-value">{streak}</span>
          <span className="level-hero__stat-label">Streak</span>
        </div>
      </div>
    </motion.div>
  );
}
