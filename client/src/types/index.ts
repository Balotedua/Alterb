// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
}

// ─── Finance ──────────────────────────────────────────────────────────────────
export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string; // ISO string
  created_at: string;
}

export interface TransactionInput {
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string;
}

// ─── Psychology ───────────────────────────────────────────────────────────────
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface MoodEntry {
  id: string;
  user_id: string;
  mood: MoodLevel;
  note?: string;
  date: string;
  created_at: string;
}

export interface MoodEntryInput {
  mood: MoodLevel;
  note?: string;
  date: string;
}

// ─── Health ───────────────────────────────────────────────────────────────────
export interface SleepRecord {
  id: string;
  user_id: string;
  duration_minutes: number;
  quality: 1 | 2 | 3 | 4 | 5;
  date: string;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  type: string;
  duration_minutes: number;
  date: string;
  created_at: string;
}

export interface BodyVital {
  id: string;
  weight_kg?: number;
  height_cm?: number;
  date: string;
}

export type ExerciseUnit = 'reps' | 'seconds' | 'kg';

export interface ExerciseMax {
  id: string;
  exercise: string;
  value: number;
  unit: ExerciseUnit;
  date: string;
}

export interface SleepEntry {
  id: string;
  duration_minutes: number;
  quality: 1 | 2 | 3 | 4 | 5;
  date: string;
}

// ─── Consciousness ────────────────────────────────────────────────────────────
export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface NoteInput {
  title: string;
  content: string;
  tags?: string[];
}

// ─── Badges / Gamification ───────────────────────────────────────────────────
export interface Badge {
  id: string;
  label: string;
  icon: string;
  description: string;
  xpRequired?: number;
}

export interface LevelRank {
  level: number;
  rank: string;
  title: string;
}

// ─── Config atoms ─────────────────────────────────────────────────────────────
export interface MoodConfig {
  id: MoodLevel;
  label: string;
  emoji: string;
  color: string;
}

export interface CategoryConfig {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export interface ActivityConfig {
  id: string;
  label: string;
  icon: string;
}

// ─── Theme ────────────────────────────────────────────────────────────────────
export type ThemeName = 'minimal' | 'neon' | 'carbon' | 'aurora';

export interface ThemeVars {
  '--bg': string;
  '--bg-surface': string;
  '--text': string;
  '--text-muted': string;
  '--accent': string;
  '--accent-soft': string;
  '--border': string;
  '--radius': string;
}

export type ThemeMap = Record<ThemeName, ThemeVars>;

// ─── API response wrapper ─────────────────────────────────────────────────────
export interface ApiError {
  message: string;
  status: number;
}
