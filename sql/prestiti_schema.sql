-- Prestiti schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE finance_prestiti (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('dato', 'ricevuto')),
  persona    TEXT NOT NULL,
  importo    DECIMAL(10,2) NOT NULL CHECK (importo > 0),
  data       DATE NOT NULL DEFAULT CURRENT_DATE,
  note       TEXT,
  saldato    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fp_user   ON finance_prestiti(user_id);
CREATE INDEX idx_fp_saldato ON finance_prestiti(user_id, saldato);

ALTER TABLE finance_prestiti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_select" ON finance_prestiti FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fp_insert" ON finance_prestiti FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fp_update" ON finance_prestiti FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fp_delete" ON finance_prestiti FOR DELETE USING (auth.uid() = user_id);
