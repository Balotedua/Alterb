export type Sex = 'M' | 'F' | 'X';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | '0+' | '0-';
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';
export type HealthLogCategory = 'activity' | 'nutrition' | 'hydration' | 'sleep' | 'biometric';
export type HealthLogKey =
  | 'steps'
  | 'calories_burned'
  | 'calories_in'
  | 'water_ml'
  | 'sleep_minutes'
  | 'weight_kg'
  | 'body_fat_pct';
export type HealthGoalKey =
  | 'steps_target'
  | 'water_ml_target'
  | 'calories_target'
  | 'sleep_minutes_target';

export interface HealthProfile {
  id: string;
  user_id: string;
  height_cm: number | null;
  sex: Sex | null;
  blood_type: BloodType | null;
  birth_year: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  is_smoker: boolean;
  activity_level: ActivityLevel;
  allergies: string[];
  conditions: string[];
  is_setup_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyHealthLog {
  id: string;
  user_id: string;
  date: string;
  category: HealthLogCategory;
  key: HealthLogKey;
  value: { amount: number };
  created_at: string;
  updated_at: string;
}

export interface HealthGoal {
  id: string;
  user_id: string;
  key: HealthGoalKey;
  value: { amount: number };
  updated_at: string;
}

export const DEFAULT_GOALS: Record<HealthGoalKey, number> = {
  steps_target: 10_000,
  water_ml_target: 2_000,
  calories_target: 2_500,
  sleep_minutes_target: 480,
};

export interface LogMetricInput {
  category: HealthLogCategory;
  key: HealthLogKey;
  amount: number;
  date?: string;
  mode?: 'add' | 'set';
}
