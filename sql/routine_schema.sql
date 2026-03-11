-- ── Routine & Appuntamenti ─────────────────────────────────────────────────────
-- Eseguire nel SQL Editor di Supabase.

-- ── Tabella routine ricorrenti ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  time_of_day  time,                  -- NULL = nessun orario fisso
  frequency    text NOT NULL DEFAULT 'daily',
                                      -- 'daily' | 'weekly' | 'monthly'
  days_of_week int[] DEFAULT '{}',    -- weekly: [0=Dom, 1=Lun, ..., 6=Sab]
  day_of_month int,                   -- monthly: 1-31
  color        text DEFAULT 'violet', -- 'violet' | 'teal' | 'amber' | 'red' | 'blue'
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- ── Completamenti giornalieri ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routine_completions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id     uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  completed_at   timestamptz DEFAULT now(),
  UNIQUE(routine_id, scheduled_date)
);

-- ── Appuntamenti / eventi one-shot ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  location         text,
  appointment_date date NOT NULL,
  appointment_time time,             -- NULL = tutto il giorno
  is_done          boolean DEFAULT false,
  color            text DEFAULT 'violet',
  created_at       timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.routines             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_completions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments         ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routines' AND policyname = 'own_routines'
  ) THEN
    CREATE POLICY "own_routines"            ON public.routines
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routine_completions' AND policyname = 'own_completions'
  ) THEN
    CREATE POLICY "own_completions"         ON public.routine_completions
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'own_appointments'
  ) THEN
    CREATE POLICY "own_appointments"        ON public.appointments
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
