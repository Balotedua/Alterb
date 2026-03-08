import type { MoodConfig, CategoryConfig, ActivityConfig, Badge, LevelRank } from '@/types';

export const MOOD_CONFIG: MoodConfig[] = [
  { id: 1, label: 'Pessimo', emoji: '😞', color: '#ef4444' },
  { id: 2, label: 'Triste', emoji: '😕', color: '#f97316' },
  { id: 3, label: 'Neutro', emoji: '😐', color: '#eab308' },
  { id: 4, label: 'Bene', emoji: '🙂', color: '#22c55e' },
  { id: 5, label: 'Ottimo', emoji: '😄', color: '#06b6d4' },
];

export const CAT_CONFIG: CategoryConfig[] = [
  { id: 'food', label: 'Cibo & Spesa', icon: '🛒', color: '#f97316' },
  { id: 'transport', label: 'Trasporti', icon: '🚌', color: '#3b82f6' },
  { id: 'health', label: 'Salute', icon: '💊', color: '#22c55e' },
  { id: 'entertainment', label: 'Svago', icon: '🎮', color: '#a855f7' },
  { id: 'utilities', label: 'Bollette', icon: '⚡', color: '#eab308' },
  { id: 'income', label: 'Entrate', icon: '💰', color: '#10b981' },
  { id: 'other', label: 'Altro', icon: '📦', color: '#6b7280' },
];

export const ACT_CONFIG: ActivityConfig[] = [
  { id: 'run', label: 'Corsa', icon: '🏃' },
  { id: 'gym', label: 'Palestra', icon: '🏋️' },
  { id: 'swim', label: 'Nuoto', icon: '🏊' },
  { id: 'bike', label: 'Bici', icon: '🚴' },
  { id: 'walk', label: 'Camminata', icon: '🚶' },
  { id: 'yoga', label: 'Yoga', icon: '🧘' },
  { id: 'other', label: 'Altro', icon: '⚡' },
];

export const XP_TABLE: number[] = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];

export const LEVEL_RANKS: LevelRank[] = [
  { level: 1, rank: 'Novizio', title: 'Inizio del percorso' },
  { level: 2, rank: 'Apprendista', title: 'Primi passi' },
  { level: 3, rank: 'Praticante', title: 'Costruendo abitudini' },
  { level: 4, rank: 'Esperto', title: 'Disciplina in crescita' },
  { level: 5, rank: 'Maestro', title: 'Padronanza delle routine' },
  { level: 6, rank: 'Saggio', title: 'Equilibrio mentale' },
  { level: 7, rank: 'Guardiano', title: 'Custode del benessere' },
  { level: 8, rank: 'Illuminato', title: 'Piena consapevolezza' },
  { level: 9, rank: 'Asceso', title: 'Oltre i limiti' },
  { level: 10, rank: 'Leggenda', title: 'Alter Master' },
];

export const BADGES: Badge[] = [
  { id: 'first_log', label: 'Prima Nota', icon: '📝', description: 'Hai registrato il primo elemento' },
  { id: 'streak_7', label: '7 Giorni', icon: '🔥', description: 'Streak di 7 giorni consecutivi' },
  { id: 'streak_30', label: '30 Giorni', icon: '🌟', description: 'Streak di 30 giorni consecutivi' },
  { id: 'mood_master', label: 'Mood Master', icon: '🧠', description: '30 entry di umore registrate' },
  { id: 'finance_pro', label: 'Finance Pro', icon: '💎', description: '50 transazioni registrate' },
  { id: 'health_hero', label: 'Health Hero', icon: '💪', description: '20 attività registrate' },
  { id: 'explorer', label: 'Esploratore', icon: '🗺️', description: 'Visitato tutte le sezioni' },
];

export const CAT_LABELS: Record<string, string> = Object.fromEntries(
  CAT_CONFIG.map((c) => [c.id, c.label]),
);

export const CAT_ORDER: string[] = CAT_CONFIG.map((c) => c.id);
