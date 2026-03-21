-- Alter OS — pgvector Upgrade (optional)
-- Run this in Supabase SQL Editor AFTER vault_schema.sql
-- Requires pgvector extension (enabled by default on Supabase)

-- ────────────────────────────────────────────────────────────
-- 1. Enable pgvector extension
-- ────────────────────────────────────────────────────────────
create extension if not exists vector;

-- ────────────────────────────────────────────────────────────
-- 2. Add embedding column (32-dim matches semanticVec.ts)
-- ────────────────────────────────────────────────────────────
alter table public.vault
  add column if not exists embedding vector(32);

-- ────────────────────────────────────────────────────────────
-- 3. IVFFlat index for fast approximate nearest-neighbor search
-- ────────────────────────────────────────────────────────────
create index if not exists vault_embedding_ivfflat_idx
  on public.vault using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- ────────────────────────────────────────────────────────────
-- 4. RPC: get category centroid similarities for a user
--    Returns pairs with cosine similarity > 0.55
-- ────────────────────────────────────────────────────────────
create or replace function get_star_similarities(p_user_id uuid)
returns table(cat_a text, cat_b text, similarity float)
language sql stable as $$
  with centroids as (
    select
      category,
      avg(embedding) as centroid
    from public.vault
    where user_id = p_user_id
      and embedding is not null
    group by category
  )
  select
    a.category as cat_a,
    b.category as cat_b,
    (1 - (a.centroid <=> b.centroid))::float as similarity
  from centroids a
  join centroids b on a.category < b.category
  where 1 - (a.centroid <=> b.centroid) > 0.55
  order by similarity desc;
$$;

-- ────────────────────────────────────────────────────────────
-- 5. BACKFILL: popola embedding dalle righe con _embedding nel JSONB
-- ────────────────────────────────────────────────────────────
-- Esegui questo DOPO la migration se hai già righe nel DB.
-- data->>'_embedding' restituisce '[0.1,0.2,...]', formato accettato da pgvector.
update public.vault
set embedding = (data->>'_embedding')::vector
where embedding is null
  and data ? '_embedding';

-- ────────────────────────────────────────────────────────────
-- NOTE: After running this migration, update vaultService.ts
-- saveEntry to also write to the embedding column:
--
--   .insert({ user_id, category, data: dataWithVec,
--             embedding: `[${generateVec(category,data).join(',')}]` })
-- ────────────────────────────────────────────────────────────
