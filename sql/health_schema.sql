-- ═══════════════════════════════════════════════════════════════════════════════
-- HEALTH DASHBOARD — Schema Supabase
-- Incolla questo nel SQL Editor di Supabase (Database → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. BODY VITALS ──────────────────────────────────────────────────────────────
--    Una riga per ogni misurazione di peso / altezza dell'utente.

create table if not exists public.body_vitals (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  weight_kg  numeric(5, 2),          -- es. 72.50  (nullable: può registrare solo altezza)
  height_cm  numeric(5, 1),          -- es. 175.0  (nullable: può registrare solo peso)
  date       date        not null,
  created_at timestamptz not null default now(),

  constraint body_vitals_weight_positive check (weight_kg  is null or weight_kg  > 0),
  constraint body_vitals_height_positive check (height_cm  is null or height_cm  > 0),
  constraint body_vitals_at_least_one    check (weight_kg is not null or height_cm is not null)
);

create index if not exists body_vitals_user_date_idx
  on public.body_vitals (user_id, date desc);

alter table public.body_vitals enable row level security;

create policy "body_vitals: select own"  on public.body_vitals for select  using (auth.uid() = user_id);
create policy "body_vitals: insert own"  on public.body_vitals for insert  with check (auth.uid() = user_id);
create policy "body_vitals: delete own"  on public.body_vitals for delete  using (auth.uid() = user_id);


-- ── 2. EXERCISE MAXES ───────────────────────────────────────────────────────────
--    Storico dei massimali per ogni esercizio.
--    Più righe per lo stesso esercizio = storico dei PR nel tempo.

create table if not exists public.exercise_maxes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  exercise   text        not null,                  -- es. 'Flessioni', 'Plank'
  value      numeric(8, 2) not null,                -- reps / secondi / kg
  unit       text        not null,                  -- 'reps' | 'seconds' | 'kg'
  date       date        not null,
  created_at timestamptz not null default now(),

  constraint exercise_maxes_unit_valid     check (unit in ('reps', 'seconds', 'kg')),
  constraint exercise_maxes_value_positive check (value >= 0)
);

create index if not exists exercise_maxes_user_exercise_idx
  on public.exercise_maxes (user_id, exercise, date desc);

alter table public.exercise_maxes enable row level security;

create policy "exercise_maxes: select own"  on public.exercise_maxes for select  using (auth.uid() = user_id);
create policy "exercise_maxes: insert own"  on public.exercise_maxes for insert  with check (auth.uid() = user_id);
create policy "exercise_maxes: update own"  on public.exercise_maxes for update  using (auth.uid() = user_id);
create policy "exercise_maxes: delete own"  on public.exercise_maxes for delete  using (auth.uid() = user_id);


-- ── 3. SLEEP ENTRIES ────────────────────────────────────────────────────────────
--    Una riga per ogni notte registrata.

create table if not exists public.sleep_entries (
  id               uuid     primary key default gen_random_uuid(),
  user_id          uuid     not null references auth.users(id) on delete cascade,
  duration_minutes integer  not null,     -- durata totale in minuti
  quality          smallint not null,     -- 1 (pessima) … 5 (ottima)
  date             date     not null,     -- data della notte (es. 2026-03-08)
  created_at       timestamptz not null default now(),

  constraint sleep_entries_quality_range   check (quality between 1 and 5),
  constraint sleep_entries_duration_min    check (duration_minutes > 0)
);

create index if not exists sleep_entries_user_date_idx
  on public.sleep_entries (user_id, date desc);

alter table public.sleep_entries enable row level security;

create policy "sleep_entries: select own"  on public.sleep_entries for select  using (auth.uid() = user_id);
create policy "sleep_entries: insert own"  on public.sleep_entries for insert  with check (auth.uid() = user_id);
create policy "sleep_entries: delete own"  on public.sleep_entries for delete  using (auth.uid() = user_id);


-- ── 4. WATER LOG ────────────────────────────────────────────────────────────────
--    Una riga per utente per giorno (upsert). Traccia bicchieri d'acqua.

create table if not exists public.water_log (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       date        not null,
  glasses    smallint    not null default 0,
  updated_at timestamptz not null default now(),

  constraint water_log_glasses_range check (glasses between 0 and 20),
  unique (user_id, date)             -- un solo record per utente per giorno
);

create index if not exists water_log_user_date_idx
  on public.water_log (user_id, date desc);

alter table public.water_log enable row level security;

create policy "water_log: select own"  on public.water_log for select  using (auth.uid() = user_id);
create policy "water_log: insert own"  on public.water_log for insert  with check (auth.uid() = user_id);
create policy "water_log: update own"  on public.water_log for update  using (auth.uid() = user_id);


-- ── TRIGGER HELPER ───────────────────────────────────────────────────────────
--    Funzione riutilizzata dai trigger updated_at su tutte le nuove tabelle.

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── 5. HEALTH PROFILES ───────────────────────────────────────────────────────
--    Un solo profilo per utente (UNIQUE su user_id).
--    Raccoglie dati anagrafici, composizione corporea e stile di vita.

create table if not exists public.health_profiles (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  height_cm           smallint,
  sex                 text        check (sex in ('M', 'F', 'X')),
  blood_type          text        check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-')),
  birth_year          smallint,
  weight_kg           numeric(5, 2),
  body_fat_pct        numeric(4, 1),
  is_smoker           boolean     not null default false,
  activity_level      text        not null default 'sedentary'
                                  check (activity_level in ('sedentary', 'light', 'active', 'very_active')),
  allergies           text[]      not null default '{}',
  conditions          text[]      not null default '{}',
  is_setup_completed  boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (user_id)
);

alter table public.health_profiles enable row level security;

create policy "health_profiles: select own"  on public.health_profiles for select  using (auth.uid() = user_id);
create policy "health_profiles: insert own"  on public.health_profiles for insert  with check (auth.uid() = user_id);
create policy "health_profiles: update own"  on public.health_profiles for update  using (auth.uid() = user_id);
create policy "health_profiles: delete own"  on public.health_profiles for delete  using (auth.uid() = user_id);

create trigger health_profiles_updated_at
  before update on public.health_profiles
  for each row execute function public.update_updated_at_column();


-- ── 6. DAILY HEALTH LOGS ─────────────────────────────────────────────────────
--    Una riga per utente + data + chiave metrica (steps, calorie, ecc.).
--    Usa JSONB per il valore così da supportare qualsiasi tipo di payload.

create table if not exists public.daily_health_logs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  date        date        not null default current_date,
  category    text        not null
              check (category in ('activity', 'nutrition', 'hydration', 'sleep', 'biometric')),
  key         text        not null,   -- steps | calories_burned | calories_in | water_ml | sleep_minutes | weight_kg | body_fat_pct
  value       jsonb       not null,   -- es. {"amount": 8000}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, date, key)
);

create index if not exists daily_health_logs_user_date_idx
  on public.daily_health_logs (user_id, date desc);

alter table public.daily_health_logs enable row level security;

create policy "daily_health_logs: select own"  on public.daily_health_logs for select  using (auth.uid() = user_id);
create policy "daily_health_logs: insert own"  on public.daily_health_logs for insert  with check (auth.uid() = user_id);
create policy "daily_health_logs: update own"  on public.daily_health_logs for update  using (auth.uid() = user_id);
create policy "daily_health_logs: delete own"  on public.daily_health_logs for delete  using (auth.uid() = user_id);

create trigger daily_health_logs_updated_at
  before update on public.daily_health_logs
  for each row execute function public.update_updated_at_column();


-- ── 7. HEALTH GOALS ──────────────────────────────────────────────────────────
--    Una riga per utente + chiave obiettivo (steps_target, ecc.).

create table if not exists public.health_goals (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  key         text        not null,   -- steps_target | water_ml_target | calories_target | sleep_minutes_target
  value       jsonb       not null,   -- es. {"amount": 10000}
  updated_at  timestamptz not null default now(),

  unique (user_id, key)
);

alter table public.health_goals enable row level security;

create policy "health_goals: select own"  on public.health_goals for select  using (auth.uid() = user_id);
create policy "health_goals: insert own"  on public.health_goals for insert  with check (auth.uid() = user_id);
create policy "health_goals: update own"  on public.health_goals for update  using (auth.uid() = user_id);
create policy "health_goals: delete own"  on public.health_goals for delete  using (auth.uid() = user_id);

create trigger health_goals_updated_at
  before update on public.health_goals
  for each row execute function public.update_updated_at_column();
