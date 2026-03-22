-- Alter OS — Universal Vault Schema
-- Run this in Supabase SQL Editor

-- ────────────────────────────────────────────────────────────
-- 1. VAULT TABLE
-- ────────────────────────────────────────────────────────────
create table if not exists public.vault (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  category    text        not null,
  data        jsonb       not null default '{}',
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- ────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ────────────────────────────────────────────────────────────
create index if not exists vault_user_id_idx       on public.vault(user_id);
create index if not exists vault_category_idx      on public.vault(category);
create index if not exists vault_user_cat_idx      on public.vault(user_id, category);
create index if not exists vault_created_at_idx    on public.vault(created_at desc);
create index if not exists vault_data_gin_idx      on public.vault using gin(data);

-- ────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
alter table public.vault enable row level security;

create policy "own_select" on public.vault for select  using (auth.uid() = user_id);
create policy "own_insert" on public.vault for insert  with check (auth.uid() = user_id);
create policy "own_update" on public.vault for update  using (auth.uid() = user_id);
create policy "own_delete" on public.vault for delete  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 4. AUTO-UPDATE updated_at
-- ────────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vault_updated_at on public.vault;
create trigger vault_updated_at
  before update on public.vault
  for each row execute function public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 5. REALTIME (enable for live star updates)
-- ────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.vault;

-- ────────────────────────────────────────────────────────────
-- 6. BUG REPORTS TABLE
-- ────────────────────────────────────────────────────────────
create table if not exists public.bug_reports (
  id                   uuid        default gen_random_uuid() primary key,
  user_id              uuid        references auth.users(id) on delete set null,
  type                 text        not null check (type in ('bug', 'improvement')),
  status               text        not null default 'pending_review'
                                   check (status in ('pending_review','open','in_progress','resolved','wont_fix')),
  priority             text        check (priority in ('high', 'medium', 'low')),
  complexity           text        check (complexity in ('high', 'medium', 'low')),
  user_description     text        not null,
  interaction_history  jsonb       default '[]',
  page_path            text,
  created_at           timestamptz default now() not null
);

-- Allow anyone (incl. anon) to insert a report
alter table public.bug_reports enable row level security;
create policy "anyone_insert_bug"        on public.bug_reports for insert with check (true);
-- Authenticated users can read, update and delete (admin gating is handled in the UI)
create policy "auth_select_bug"          on public.bug_reports for select  using (auth.role() = 'authenticated');
create policy "auth_update_bug"          on public.bug_reports for update  using (auth.role() = 'authenticated');
create policy "auth_delete_bug"          on public.bug_reports for delete  using (auth.role() = 'authenticated');

-- Migration: add columns if table already exists
alter table public.bug_reports add column if not exists priority   text check (priority   in ('high','medium','low'));
alter table public.bug_reports add column if not exists complexity text check (complexity in ('high','medium','low'));
