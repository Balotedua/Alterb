-- Alter OS — Supabase Storage: "documents" bucket
-- Run this once in Supabase SQL Editor (or Dashboard > Storage)

-- 1. Create bucket (if not already created via Dashboard)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,                   -- private: access only via signed URLs
  52428800,                -- 50 MB max per file
  array['application/pdf','image/jpeg','image/png','image/webp','image/gif','text/plain']
)
on conflict (id) do nothing;

-- 2. RLS: users can only access their own folder (userId is the first path segment)
create policy "own_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
