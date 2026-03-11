-- Admin RPC functions — eseguire nel SQL Editor di Supabase.
-- Usano SECURITY DEFINER per bypassare RLS e accedere a auth.users.

-- ── 0. Colonna last_seen su profiles ─────────────────────────────────────────
-- Aggiunge last_seen solo se non esiste già.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- ── 0b. Aggiorna last_seen per l'utente corrente (bypassa RLS) ───────────────
-- Chiamata dall'app ad ogni caricamento (anche auto-login da sessione salvata).
-- Usa SECURITY DEFINER + auth.uid() per non dipendere dalle policy RLS di UPDATE.
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_last_seen() TO authenticated;

-- ── 1. Conteggi reali per ogni tabella (bypassa RLS) ────────────────────────
-- Usa SQL dinamico per saltare tabelle non ancora create.
CREATE OR REPLACE FUNCTION public.admin_get_table_counts()
RETURNS TABLE(table_name text, row_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions','bug_reports','profiles','mood_entries',
    'sleep_logs','water_logs','body_vitals','health_goals',
    'ai_usage_logs','page_views'
  ] LOOP
    BEGIN
      EXECUTE format('SELECT COUNT(*) FROM %I', t) INTO n;
      table_name := t;
      row_count  := n;
      RETURN NEXT;
    EXCEPTION WHEN undefined_table OR invalid_schema_name THEN
      -- tabella non ancora creata — la saltiamo
      NULL;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_table_counts() TO authenticated;

-- ── 2. Statistiche utenti da auth.users + profiles.last_seen ─────────────────
-- last_seen è aggiornato dall'app ad ogni caricamento (anche auto-login).
-- Fallback: se last_seen è NULL usa last_sign_in_at di auth.users.
CREATE OR REPLACE FUNCTION public.admin_get_user_stats()
RETURNS TABLE(
  total_users  bigint,
  users_today  bigint,
  last_login   timestamptz,
  user_list    jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (
      WHERE COALESCE(p.last_seen, u.last_sign_in_at) >= NOW() - INTERVAL '24 hours'
    )::bigint,
    MAX(COALESCE(p.last_seen, u.last_sign_in_at)),
    jsonb_agg(
      jsonb_build_object(
        'id',              u.id,
        'email',           u.email,
        'created_at',      u.created_at,
        'last_sign_in_at', COALESCE(p.last_seen, u.last_sign_in_at)
      )
      ORDER BY COALESCE(p.last_seen, u.last_sign_in_at) DESC NULLS LAST
    )
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_stats() TO authenticated;

-- ── 3. Dimensioni tabelle ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE(table_name text, row_count bigint, size_bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.relname::text,
    s.n_live_tup::bigint,
    pg_total_relation_size(s.relid)::bigint
  FROM pg_stat_user_tables s
  WHERE s.schemaname = 'public'
  ORDER BY pg_total_relation_size(s.relid) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO authenticated;

-- ── 4. CHECK constraint bug_reports per pending_review ───────────────────────
ALTER TABLE bug_reports
  DROP CONSTRAINT IF EXISTS bug_reports_status_check;

ALTER TABLE bug_reports
  ADD CONSTRAINT bug_reports_status_check
  CHECK (status IN ('pending_review', 'open', 'in_progress', 'resolved', 'wont_fix'));

ALTER TABLE bug_reports
  ALTER COLUMN status SET DEFAULT 'pending_review';
