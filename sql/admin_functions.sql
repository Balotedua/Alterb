-- Admin RLS update — sostituisce le RPC con query dirette.
-- Da eseguire nel SQL Editor di Supabase.

-- 1. Rimuovi la policy di lettura restrittiva (solo proprio utente)
DROP POLICY IF EXISTS "users_read_own_bug_reports" ON bug_reports;

-- 2. Tutti gli utenti autenticati possono leggere tutti i report
--    (il gate è la password client-side nell'area admin)
CREATE POLICY "authenticated_read_all_bug_reports"
  ON bug_reports FOR SELECT
  TO authenticated
  USING (true);

-- 3. Tutti gli utenti autenticati possono aggiornare i report (status, notes)
DROP POLICY IF EXISTS "authenticated_update_bug_reports" ON bug_reports;
CREATE POLICY "authenticated_update_bug_reports"
  ON bug_reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Le funzioni RPC non servono più — puoi ignorarle o droppare se vuoi
-- DROP FUNCTION IF EXISTS get_all_bug_reports();
-- DROP FUNCTION IF EXISTS update_bug_report_status(uuid, text);
-- DROP FUNCTION IF EXISTS update_bug_report_notes(uuid, text);
