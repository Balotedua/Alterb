-- ═══════════════════════════════════════════════════════════════════════════════
-- WORKOUT SESSIONS — Medical Terminal Schema
-- Raggruppa gli exercise_maxes in sessioni di allenamento con stato e note.
-- Incolla nel SQL Editor di Supabase.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. WORKOUT SESSIONS ──────────────────────────────────────────────────────
--    Una riga per ogni sessione di allenamento completa.

create table if not exists public.workout_sessions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  date        date        not null default current_date,
  notes       text,
  duration_m  smallint,                          -- durata sessione in minuti
  rpe         smallint check (rpe between 1 and 10), -- Rate of Perceived Exertion
  created_at  timestamptz not null default now()
);

create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, date desc);

alter table public.workout_sessions enable row level security;

create policy "workout_sessions: select own" on public.workout_sessions for select using (auth.uid() = user_id);
create policy "workout_sessions: insert own" on public.workout_sessions for insert with check (auth.uid() = user_id);
create policy "workout_sessions: update own" on public.workout_sessions for update using (auth.uid() = user_id);
create policy "workout_sessions: delete own" on public.workout_sessions for delete using (auth.uid() = user_id);


-- ── 2. SESSION → EXERCISE link ───────────────────────────────────────────────
--    Collega ogni session ai singoli exercise_maxes registrati in quella sessione.

create table if not exists public.session_exercises (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_max_id uuid not null references public.exercise_maxes(id) on delete cascade,
  sets           smallint,
  reps_per_set   smallint,
  rest_seconds   smallint,
  created_at     timestamptz not null default now()
);

alter table public.session_exercises enable row level security;

-- RLS via join: owner of session_id = owner of the session
create policy "session_exercises: select own" on public.session_exercises
  for select using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_id and ws.user_id = auth.uid()
    )
  );
create policy "session_exercises: insert own" on public.session_exercises
  for insert with check (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_id and ws.user_id = auth.uid()
    )
  );
create policy "session_exercises: delete own" on public.session_exercises
  for delete using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_id and ws.user_id = auth.uid()
    )
  );


-- ── 3. HELPER VIEW — session_summary ─────────────────────────────────────────
--    Vista aggregata: data, n. esercizi, PR più pesante, RPE per la UI.

create or replace view public.session_summary as
select
  ws.id,
  ws.user_id,
  ws.date,
  ws.rpe,
  ws.duration_m,
  ws.notes,
  count(se.id)::int             as exercise_count,
  max(em.value)                 as peak_load_kg,
  ws.created_at
from public.workout_sessions ws
left join public.session_exercises se  on se.session_id     = ws.id
left join public.exercise_maxes    em  on em.id             = se.exercise_max_id
                                       and em.unit          = 'kg'
group by ws.id, ws.user_id, ws.date, ws.rpe, ws.duration_m, ws.notes, ws.created_at;

-- Note: RLS on the view is inherited from workout_sessions via the join.
-- Grant select to authenticated users:
grant select on public.session_summary to authenticated;


-- ── 4. RPC — get_pr_trend ────────────────────────────────────────────────────
--    Ritorna lo storico di un esercizio per l'utente autenticato.
--    Usato dalla NeonPulseChart.

create or replace function public.get_pr_trend(p_exercise text)
returns table (
  date  date,
  value numeric
)
language sql
security definer
as $$
  select date, value
  from public.exercise_maxes
  where user_id = auth.uid()
    and exercise = p_exercise
    and unit = 'kg'
  order by date asc;
$$;

grant execute on function public.get_pr_trend(text) to authenticated;
