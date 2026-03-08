import { getLevel, getRank } from '@/utils/badgeUtils';
import { XP_TABLE } from '@/utils/constants';

interface LevelProgressProps {
  xp?: number;
}

export function LevelProgress({ xp = 0 }: LevelProgressProps) {
  const level = getLevel(xp);
  const rank = getRank(level);
  const currentThreshold = XP_TABLE[level - 1] ?? 0;
  const nextThreshold = XP_TABLE[level] ?? XP_TABLE[XP_TABLE.length - 1];
  const progress = nextThreshold > currentThreshold
    ? ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100;

  return (
    <div className="level-progress">
      <div className="level-progress__header">
        <span className="level-progress__level">Livello {level}</span>
        {rank ? (
          <span className="level-progress__rank">{rank.rank} · {rank.title}</span>
        ) : null}
        <span className="level-progress__xp">{xp} XP</span>
      </div>
      <div className="level-progress__bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="level-progress__fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="level-progress__next">
        Prossimo livello: {nextThreshold} XP
      </p>
    </div>
  );
}
