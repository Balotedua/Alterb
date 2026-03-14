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
  notes?: string;
  date: string; // ISO string
  created_at: string;
  hidden_from_charts?: boolean;
}

export interface TransactionInput {
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  notes?: string;
  date: string;
}

// ─── Patrimonio ───────────────────────────────────────────────────────────────
export type PatrimonioAssetType =
  | 'checking'
  | 'savings'
  | 'investments'
  | 'crypto'
  | 'cash'
  | 'real_estate'
  | 'other';

export interface PatrimonioAsset {
  id: string;
  user_id: string;
  label: string;
  asset_type: PatrimonioAssetType;
  amount: number;
  icon?: string;
  color?: string;
  updated_at: string;
  created_at: string;
}

export interface PatrimonioAssetInput {
  label: string;
  asset_type: PatrimonioAssetType;
  amount: number;
  icon?: string;
  color?: string;
}

// ─── Prestiti ─────────────────────────────────────────────────────────────────
export type PrestitoTipo = 'dato' | 'ricevuto';

export interface Prestito {
  id: string;
  user_id: string;
  tipo: PrestitoTipo;
  persona: string;
  importo: number;
  data: string;
  note?: string;
  saldato: boolean;
  created_at: string;
}

export interface PrestitoInput {
  tipo: PrestitoTipo;
  persona: string;
  importo: number;
  data: string;
  note?: string;
  saldato?: boolean;
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

export interface WorkoutSession {
  id: string;
  date: string;
  rpe: number | null;
  duration_m: number | null;
  notes: string | null;
  muscles: string[];
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

export interface Entry {
  id: string;
  user_id: string;
  raw_text: string;
  clean_text: string | null;
  created_at: string;
  tags: Tag[];
}

export interface Tag {
  id: string;
  user_id?: string;
  tag_name: string;
  created_at?: string;
}

export interface ConsciousnessReport {
  id: string;
  user_id: string;
  content: string;
  week_start: string;
  created_at: string;
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
  hidden_from_charts?: boolean;
}

export interface FinanceBudget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  created_at: string;
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
