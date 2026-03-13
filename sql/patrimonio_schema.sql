-- Tabella asset patrimoniali per utente (conti, investimenti, crypto, ecc.)
create table if not exists patrimonio_assets (
  id          uuid          primary key default gen_random_uuid(),
  user_id     uuid          not null references auth.users(id) on delete cascade,
  label       text          not null,
  asset_type  text          not null default 'other',
  amount      numeric(14,2) not null default 0 check (amount >= 0),
  icon        text,
  color       text,
  updated_at  timestamptz   not null default now(),
  created_at  timestamptz   not null default now()
);

-- Trigger per aggiornare updated_at automaticamente
create or replace function update_patrimonio_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_patrimonio_updated_at
  before update on patrimonio_assets
  for each row execute function update_patrimonio_updated_at();

-- RLS
alter table patrimonio_assets enable row level security;

create policy "select_own" on patrimonio_assets
  for select using (auth.uid() = user_id);

create policy "insert_own" on patrimonio_assets
  for insert with check (auth.uid() = user_id);

create policy "update_own" on patrimonio_assets
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete_own" on patrimonio_assets
  for delete using (auth.uid() = user_id);

-- Indici
create index if not exists idx_patrimonio_user on patrimonio_assets(user_id);
create index if not exists idx_patrimonio_type on patrimonio_assets(user_id, asset_type);
