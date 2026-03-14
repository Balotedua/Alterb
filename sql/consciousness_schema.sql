-- ─── Consciousness Inbox ──────────────────────────────────────────────────────

-- Raw thought captures
CREATE TABLE IF NOT EXISTS entries (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  raw_text   TEXT NOT NULL,
  clean_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries: user owns their rows" ON entries
  FOR ALL USING (auth.uid() = user_id);

-- Semantic tag definitions (deduplicated at AI level)
CREATE TABLE IF NOT EXISTS tags (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tag_name   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, tag_name)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags: user owns their rows" ON tags
  FOR ALL USING (auth.uid() = user_id);

-- Pivot table: many-to-many entries ↔ tags
CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE NOT NULL,
  tag_id   UUID REFERENCES tags(id)   ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (entry_id, tag_id)
);

ALTER TABLE entry_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entry_tags: user owns their rows" ON entry_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entries WHERE entries.id = entry_id AND entries.user_id = auth.uid())
  );

-- Weekly synthesis reports (AI-generated every Sunday)
CREATE TABLE IF NOT EXISTS consciousness_reports (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content    TEXT NOT NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, week_start)
);

ALTER TABLE consciousness_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports: user owns their rows" ON consciousness_reports
  FOR ALL USING (auth.uid() = user_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_entries_user_date    ON entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_user            ON tags (user_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_entry     ON entry_tags (entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag       ON entry_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_week    ON consciousness_reports (user_id, week_start DESC);

-- ─── Views ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW tags_with_count AS
SELECT
  t.id,
  t.user_id,
  t.tag_name,
  t.created_at,
  COUNT(et.entry_id)::int AS entry_count
FROM tags t
LEFT JOIN entry_tags et ON et.tag_id = t.id
GROUP BY t.id, t.user_id, t.tag_name, t.created_at
ORDER BY entry_count DESC;

-- ─── Fix: rimuovi trigger auto-delete tag orfani (se esiste) ─────────────────
-- Esegui questo in Supabase SQL Editor se i tag spariscono quando le note vengono eliminate
-- DROP TRIGGER IF EXISTS cleanup_orphan_tags ON entry_tags;
-- DROP FUNCTION IF EXISTS cleanup_orphan_tags();

-- ─── pg_cron: Weekly Report (enable if pg_cron extension is active) ──────────
-- SELECT cron.schedule('weekly-consciousness-report', '59 23 * * 0',
--   $$SELECT net.http_post('https://<project-ref>.supabase.co/functions/v1/weekly-report', '{}', 'application/json', ARRAY[http_header('Authorization','Bearer <service-role-key>')])$$
-- );
