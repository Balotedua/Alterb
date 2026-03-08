// ─── Gamification Types ──────────────────────────────────────────────────────

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type GamificationEventType =
  | 'note_created'
  | 'transaction_added'
  | 'mood_logged'
  | 'activity_logged'
  | 'streak_increment'
  | 'section_visited';

export interface BadgeCriteria {
  event_type: GamificationEventType;
  threshold?: number;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;       // Lucide component name, e.g. "Flame"
  rarity: BadgeRarity;
  xp_reward: number;
  criteria: BadgeCriteria;
  created_at: string;
}

export interface UserBadge {
  user_id: string;
  badge_id: string;
  unlocked_at: string;
  badge_definitions?: BadgeDefinition; // joined from Supabase
}

export interface UserGamification {
  user_id: string;
  xp: number;
  level: number;
  streak: number;
  last_active: string | null;
  updated_at: string;
}

export interface GamificationEventResult {
  awarded_badges: string[];
  xp_gained: number;
}

// Rarity display metadata
export const RARITY_META: Record<
  BadgeRarity,
  { label: string; color: string; glow: string; order: number }
> = {
  common:    { label: 'Comune',     color: '#6b7280', glow: 'rgba(107,114,128,0.25)', order: 1 },
  rare:      { label: 'Raro',       color: '#3b82f6', glow: 'rgba(59,130,246,0.30)',  order: 2 },
  epic:      { label: 'Epico',      color: '#a855f7', glow: 'rgba(168,85,247,0.35)',  order: 3 },
  legendary: { label: 'Leggendario',color: '#f59e0b', glow: 'rgba(245,158,11,0.40)', order: 4 },
};
