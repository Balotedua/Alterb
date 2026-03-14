-- Add muscles[] column to workout_sessions
-- Run this in Supabase SQL Editor

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS muscles text[] NOT NULL DEFAULT '{}';
