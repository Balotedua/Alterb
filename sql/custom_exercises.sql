-- Tabella esercizi personalizzati per gruppo muscolare
-- Esegui nel SQL Editor di Supabase

CREATE TABLE IF NOT EXISTS public.custom_exercises (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  muscle_group text NOT NULL,   -- chest | back | shoulders | arms | core | quads_glutes | head
  unit        text NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'reps', 'seconds')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indice per fetch rapida per utente
CREATE INDEX IF NOT EXISTS custom_exercises_user_id_idx
  ON public.custom_exercises (user_id);

-- Evita duplicati: stessa persona, stesso nome, stesso muscolo
CREATE UNIQUE INDEX IF NOT EXISTS custom_exercises_unique_idx
  ON public.custom_exercises (user_id, lower(name), muscle_group);

-- RLS
ALTER TABLE public.custom_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utente vede solo i propri esercizi"
  ON public.custom_exercises FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utente inserisce i propri esercizi"
  ON public.custom_exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utente elimina i propri esercizi"
  ON public.custom_exercises FOR DELETE
  USING (auth.uid() = user_id);
