import { XP_TABLE, LEVEL_RANKS, BADGES } from './constants';

/** Calcola XP totale da array di transazioni/entry. */
export function calcXP(items = []) {
  // TODO: logica XP
  return 0;
}

/** Restituisce il livello corrente basato sugli XP. */
export function getLevel(xp = 0) {
  let level = 1;
  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1;
    else break;
  }
  return level;
}

/** Restituisce il rank (titolo) del livello. */
export function getRank(level = 1) {
  return LEVEL_RANKS[level - 1] ?? null;
}

/** Verifica se un badge è stato sbloccato. */
export function isBadgeEarned(badgeId, earned = []) {
  return earned.includes(badgeId);
}

/** Restituisce i badge non ancora sbloccati. */
export function getLockedBadges(earned = []) {
  return BADGES.filter((b) => !earned.includes(b.id));
}
