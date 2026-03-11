-- Bug Reports
-- Stores user-submitted bug reports with reconstructed interaction history.

CREATE TABLE IF NOT EXISTS bug_reports (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  user_id           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Reconstructed context: last ≤5 interactions (messages, fragments opened)
  interaction_history jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Free-text description from the user
  user_description  text        NOT NULL DEFAULT '',

  -- Where the bug happened (window.location.pathname at report time)
  page_path         text        NOT NULL DEFAULT '/',

  -- Simple lifecycle
  status            text        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),

  -- Optional triage fields (filled by maintainer)
  severity          text        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  notes             text
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS bug_reports_user_id_idx    ON bug_reports (user_id);
CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON bug_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS bug_reports_status_idx     ON bug_reports (status);

-- RLS: users can insert their own reports, only service-role can read/update
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_own_bug_report"
  ON bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own reports (optional)
CREATE POLICY "users_read_own_bug_reports"
  ON bug_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
