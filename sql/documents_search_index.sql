-- Alter OS — Full-text search index for documents
-- Run this once in Supabase SQL Editor

-- 1. GIN index on extractedText field (fast ilike / full-text on documents)
--    Converts the JSONB text to a tsvector for Italian + English stemming
create index if not exists vault_doc_text_idx
  on public.vault
  using gin (
    to_tsvector(
      'italian',
      coalesce(data->>'extractedText', '')
    )
  )
  where category = 'documents';

-- 2. Index on docType (fast filtering by type: 'identity', 'utility_bill', etc.)
create index if not exists vault_doc_type_idx
  on public.vault ((data->>'docType'))
  where category = 'documents';

-- 3. Index on issuer (fast "tutte le bollette Enel")
create index if not exists vault_doc_issuer_idx
  on public.vault ((data->>'issuer'))
  where category = 'documents';
