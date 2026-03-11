-- AI Usage Logs
-- Tracks DeepSeek API calls for cost monitoring (daily/monthly/yearly).

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  user_id           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  model             text        NOT NULL DEFAULT 'deepseek-chat',
  prompt_tokens     int         NOT NULL DEFAULT 0,
  completion_tokens int         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx ON ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_logs_user_id_idx    ON ai_usage_logs (user_id);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own usage logs
CREATE POLICY "users_insert_own_ai_usage"
  ON ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- All authenticated users can read all logs (admin gate is client-side)
CREATE POLICY "authenticated_read_ai_usage"
  ON ai_usage_logs FOR SELECT
  TO authenticated
  USING (true);

-- ── Page Views ─────────────────────────────────────────────────────────────────
-- Tracks which fragments are opened, for traffic analysis.

CREATE TABLE IF NOT EXISTS page_views (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  fragment_name text        NOT NULL,
  module        text
);

CREATE INDEX IF NOT EXISTS page_views_created_at_idx    ON page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_fragment_name_idx ON page_views (fragment_name);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_page_views"
  ON page_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "authenticated_read_page_views"
  ON page_views FOR SELECT
  TO authenticated
  USING (true);

-- ── Bug Reports: add type + delete policy ─────────────────────────────────────
-- Run these if the table already exists (skip during fresh installs):

ALTER TABLE bug_reports
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'bug'
  CHECK (type IN ('bug', 'improvement'));

-- Allow admin (authenticated) to delete reports
DROP POLICY IF EXISTS "authenticated_delete_bug_reports" ON bug_reports;
CREATE POLICY "authenticated_delete_bug_reports"
  ON bug_reports FOR DELETE
  TO authenticated
  USING (true);

-- ── Bug reports: add priority field ──────────────────────────────────────────
ALTER TABLE bug_reports
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'low'
  CHECK (priority IN ('low', 'medium', 'high'));

-- ── RPC: get table sizes + row counts from pg_catalog ────────────────────────
-- Esegui nel SQL Editor di Supabase per abilitare la tab Consumi → Dimensioni DB
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE(table_name text, row_count bigint, size_bytes bigint)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.relname::text,
    c.reltuples::bigint,
    pg_total_relation_size(c.oid)::bigint
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname = ANY(ARRAY[
      'transactions','bug_reports','profiles','body_vitals',
      'sleep_logs','water_logs','health_goals','mood_entries',
      'ai_usage_logs','page_views'
    ])
  ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_table_sizes() TO authenticated;
