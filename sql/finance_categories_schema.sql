-- Tabella categorie finanziarie personalizzate per utente
create table if not exists finance_categories (
  id          text        not null,          -- slug es. 'benzina', 'palestra'
  user_id     uuid        not null references auth.users(id) on delete cascade,
  label       text        not null,
  icon        text        not null default '📦',
  color       text        not null default '#6b7280',
  created_at  timestamptz not null default now(),
  primary key (id, user_id)
);

-- RLS
alter table finance_categories enable row level security;

create policy "select_own" on finance_categories
  for select using (auth.uid() = user_id);

create policy "insert_own" on finance_categories
  for insert with check (auth.uid() = user_id);

create policy "update_own" on finance_categories
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete_own" on finance_categories
  for delete using (auth.uid() = user_id);
