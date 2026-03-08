import { XP_TABLE, LEVEL_RANKS, BADGES } from '@/utils/constants';
import type { LevelRank, Badge } from '@/types';

export function calcXP(_items: unknown[]): number {
  // TODO: logica XP basata sui dati reali
  return 0;
}

export function getLevel(xp = 0): number {
  let level = 1;
  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1;
    else break;
  }
  return level;
}

export function getRank(level = 1): LevelRank | null {
  return LEVEL_RANKS[level - 1] ?? null;
}

export function isBadgeEarned(badgeId: string, earned: string[] = []): boolean {
  return earned.includes(badgeId);
}

export function getLockedBadges(earned: string[] = []): Badge[] {
  return BADGES.filter((b) => !earned.includes(b.id));
}
