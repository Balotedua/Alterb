-- ─── Nexus: Social Layer ─────────────────────────────────────
-- Run this in Supabase SQL Editor

-- 1. Public user profiles (searchable, category counts are public)
create table if not exists user_profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  username     text unique,           -- from email prefix, for search
  display_name text,                  -- custom name from settings
  public_stats jsonb default '{}'::jsonb,  -- { category: count } shared publicly
  created_at   timestamptz default now()
);

alter table user_profiles enable row level security;

create policy "profiles_select_all"  on user_profiles for select using (true);
create policy "profiles_insert_own"  on user_profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own"  on user_profiles for update using (auth.uid() = user_id);
create policy "profiles_delete_own"  on user_profiles for delete using (auth.uid() = user_id);
create extension if not exists pg_trgm;
-- Index for username search
create index if not exists user_profiles_username_idx on user_profiles using gin(username gin_trgm_ops);

-- 2. Friendships
create table if not exists friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users on delete cascade not null,
  addressee_id uuid references auth.users on delete cascade not null,
  status       text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz default now(),
  unique(requester_id, addressee_id)
);

alter table friendships enable row level security;

create policy "friendships_all" on friendships for all
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- 3. Direct messages between friends
create table if not exists friend_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid references auth.users on delete cascade not null,
  recipient_id uuid references auth.users on delete cascade not null,
  text         text not null,
  created_at   timestamptz default now()
);

alter table friend_messages enable row level security;

create policy "messages_all" on friend_messages for all
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create index if not exists friend_messages_pair_idx
  on friend_messages (sender_id, recipient_id, created_at desc);

-- 4. Challenges between friends
create table if not exists challenges (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid references auth.users on delete cascade not null,
  target_id        uuid references auth.users on delete cascade not null,
  title            text not null,
  category         text not null default 'generale',
  target_value     numeric,
  unit             text,
  end_date         date,
  creator_progress numeric default 0,
  target_progress  numeric default 0,
  status           text default 'active' check (status in ('active', 'completed', 'declined')),
  created_at       timestamptz default now()
);

alter table challenges enable row level security;

create policy "challenges_all" on challenges for all
  using (auth.uid() = creator_id or auth.uid() = target_id);

-- Note: enable pg_trgm extension if not already active (for username search):
-- create extension if not exists pg_trgm;
