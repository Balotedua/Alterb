-- ═══════════════════════════════════════════════════════════════════════════
-- GAMIFICATION SCHEMA — Alter Life Tracker
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── TABLES ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badge_definitions (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  icon        TEXT        NOT NULL,  -- Lucide icon name (e.g. "Flame") or emoji
  rarity      TEXT        NOT NULL DEFAULT 'common'
                          CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  xp_reward   INTEGER     NOT NULL DEFAULT 50,
  criteria    JSONB       NOT NULL DEFAULT '{}',
  -- criteria shape: { "event_type": "transaction_added", "threshold": 1 }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_gamification (
  user_id     UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp          INTEGER     NOT NULL DEFAULT 0,
  level       INTEGER     NOT NULL DEFAULT 1,
  streak      INTEGER     NOT NULL DEFAULT 0,
  last_active DATE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    TEXT        NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE badge_definitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gamification  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges        ENABLE ROW LEVEL SECURITY;

-- badge_definitions: public read
CREATE POLICY "badge_definitions_public_read"
  ON badge_definitions FOR SELECT USING (true);

-- user_gamification: own row only
CREATE POLICY "user_gamification_select_own"
  ON user_gamification FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_gamification_insert_own"
  ON user_gamification FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_gamification_update_own"
  ON user_gamification FOR UPDATE USING (auth.uid() = user_id);

-- user_badges: own rows only
CREATE POLICY "user_badges_select_own"
  ON user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_badges_insert_own"
  ON user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── ENABLE REALTIME ─────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE user_badges;
ALTER PUBLICATION supabase_realtime ADD TABLE user_gamification;

-- ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

-- Ensures a user_gamification row exists
CREATE OR REPLACE FUNCTION ensure_user_gamification(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_gamification (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Adds XP and recalculates level
CREATE OR REPLACE FUNCTION add_xp(p_user_id UUID, p_xp INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_xp    INTEGER;
  new_level INTEGER := 1;
  xp_table  INTEGER[] := ARRAY[0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];
  i         INTEGER;
BEGIN
  PERFORM ensure_user_gamification(p_user_id);

  UPDATE user_gamification
  SET xp = xp + p_xp, updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING xp INTO new_xp;

  -- Recalculate level from XP table
  FOR i IN 1..array_length(xp_table, 1) LOOP
    IF new_xp >= xp_table[i] THEN
      new_level := i;
    END IF;
  END LOOP;

  UPDATE user_gamification
  SET level = new_level
  WHERE user_id = p_user_id;
END;
$$;

-- Awards a badge (idempotent) and grants its XP reward
CREATE OR REPLACE FUNCTION award_badge(p_user_id UUID, p_badge_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  badge_xp INTEGER;
BEGIN
  -- Idempotency: skip if already earned
  IF EXISTS (
    SELECT 1 FROM user_badges
    WHERE user_id = p_user_id AND badge_id = p_badge_id
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, p_badge_id);

  SELECT xp_reward INTO badge_xp FROM badge_definitions WHERE id = p_badge_id;
  IF badge_xp IS NOT NULL AND badge_xp > 0 THEN
    PERFORM add_xp(p_user_id, badge_xp);
  END IF;

  RETURN TRUE;
END;
$$;

-- ─── MAIN RPC: process_gamification_event ────────────────────────────────────
--
-- Called by the frontend BadgeService.triggerEvent().
-- p_payload should contain: { "count": <int> } for threshold-based badges.
-- For streak events, the streak is managed server-side (source of truth is DB).
--
CREATE OR REPLACE FUNCTION process_gamification_event(
  p_user_id   UUID,
  p_event_type TEXT,
  p_payload   JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result      JSONB    := '{"awarded_badges": [], "xp_gained": 0}'::JSONB;
  v_badge       RECORD;
  v_count       INTEGER  := 0;
  v_awarded     BOOLEAN;
  v_base_xp     INTEGER  := 0;
  v_today       DATE     := CURRENT_DATE;
  v_last_active DATE;
  v_streak      INTEGER;
BEGIN
  -- ── Security: caller must be the authenticated user ──
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: p_user_id does not match auth.uid()';
  END IF;

  PERFORM ensure_user_gamification(p_user_id);

  -- ── Base XP per event type ──
  CASE p_event_type
    WHEN 'note_created'      THEN v_base_xp := 10;
    WHEN 'transaction_added' THEN v_base_xp := 5;
    WHEN 'mood_logged'       THEN v_base_xp := 8;
    WHEN 'activity_logged'   THEN v_base_xp := 12;
    WHEN 'streak_increment'  THEN v_base_xp := 20;
    WHEN 'section_visited'   THEN v_base_xp := 2;
    ELSE v_base_xp := 0;
  END CASE;

  IF v_base_xp > 0 THEN
    PERFORM add_xp(p_user_id, v_base_xp);
    v_result := jsonb_set(v_result, '{xp_gained}', to_jsonb(v_base_xp));
  END IF;

  -- ── Streak management (DB is source of truth) ──
  IF p_event_type = 'streak_increment' THEN
    SELECT last_active, streak
    INTO v_last_active, v_streak
    FROM user_gamification
    WHERE user_id = p_user_id;

    IF v_last_active IS NULL OR v_last_active < v_today - INTERVAL '1 day' THEN
      -- First time or missed a day: reset streak
      UPDATE user_gamification
      SET streak = 1, last_active = v_today, updated_at = NOW()
      WHERE user_id = p_user_id;
    ELSIF v_last_active = v_today - INTERVAL '1 day' THEN
      -- Consecutive day: increment
      UPDATE user_gamification
      SET streak = streak + 1, last_active = v_today, updated_at = NOW()
      WHERE user_id = p_user_id;
    END IF;
    -- If last_active = today, already incremented today — do nothing

    SELECT streak INTO v_count FROM user_gamification WHERE user_id = p_user_id;
  ELSE
    -- For non-streak events, count is passed in payload by the frontend
    v_count := COALESCE((p_payload->>'count')::INTEGER, 0);
  END IF;

  -- ── Check all badge criteria for this event type ──
  FOR v_badge IN
    SELECT bd.id, bd.criteria
    FROM badge_definitions bd
    WHERE
      bd.criteria->>'event_type' = p_event_type
      AND NOT EXISTS (
        SELECT 1 FROM user_badges ub
        WHERE ub.user_id = p_user_id AND ub.badge_id = bd.id
      )
  LOOP
    v_awarded := FALSE;

    IF v_count >= COALESCE((v_badge.criteria->>'threshold')::INTEGER, 1) THEN
      v_awarded := award_badge(p_user_id, v_badge.id);
    END IF;

    IF v_awarded THEN
      v_result := jsonb_set(
        v_result,
        '{awarded_badges}',
        (v_result->'awarded_badges') || to_jsonb(v_badge.id)
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- ─── SEED BADGE DEFINITIONS ───────────────────────────────────────────────────

INSERT INTO badge_definitions (id, name, description, icon, rarity, xp_reward, criteria)
VALUES
  ('first_transaction',
   'Prima Transazione',
   'Hai registrato la tua prima transazione finanziaria. Il viaggio verso la libertà finanziaria inizia con un singolo passo.',
   'Wallet', 'common', 50,
   '{"event_type": "transaction_added", "threshold": 1}'),

  ('finance_beginner',
   'Finance Starter',
   'Hai registrato 10 transazioni. Stai prendendo il controllo delle tue finanze.',
   'PiggyBank', 'common', 80,
   '{"event_type": "transaction_added", "threshold": 10}'),

  ('finance_pro',
   'Finance Pro',
   'Hai registrato 50 transazioni. Sei un vero esperto di gestione finanziaria.',
   'TrendingUp', 'rare', 200,
   '{"event_type": "transaction_added", "threshold": 50}'),

  ('first_note',
   'Prima Nota',
   'Hai creato la tua prima nota. La scrittura è il primo passo verso la consapevolezza.',
   'FileText', 'common', 30,
   '{"event_type": "note_created", "threshold": 1}'),

  ('note_taker',
   'Scrittore',
   'Hai creato 20 note. La tua mente prende forma sulla pagina.',
   'BookOpen', 'rare', 120,
   '{"event_type": "note_created", "threshold": 20}'),

  ('mood_starter',
   'Primo Umore',
   'Hai registrato il tuo primo stato d''umore. Inizia a capire te stesso.',
   'Smile', 'common', 30,
   '{"event_type": "mood_logged", "threshold": 1}'),

  ('mood_master',
   'Mood Master',
   'Hai registrato 30 stati d''umore. Sei sintonizzato con le tue emozioni.',
   'Brain', 'rare', 150,
   '{"event_type": "mood_logged", "threshold": 30}'),

  ('health_starter',
   'Prima Attività',
   'Hai registrato la tua prima attività fisica. Il corpo ringrazia.',
   'Activity', 'common', 40,
   '{"event_type": "activity_logged", "threshold": 1}'),

  ('health_hero',
   'Health Hero',
   'Hai registrato 20 attività fisiche. Il tuo corpo è il tuo tempio.',
   'Dumbbell', 'rare', 150,
   '{"event_type": "activity_logged", "threshold": 20}'),

  ('streak_3',
   'Tris Perfetto',
   'Sei attivo da 3 giorni consecutivi. Le abitudini si costruiscono giorno per giorno.',
   'Zap', 'common', 60,
   '{"event_type": "streak_increment", "threshold": 3}'),

  ('streak_7',
   'Settimana di Fuoco',
   'Streak di 7 giorni consecutivi. Una settimana intera di dedizione.',
   'Flame', 'rare', 150,
   '{"event_type": "streak_increment", "threshold": 7}'),

  ('streak_30',
   'Mese Leggendario',
   'Streak di 30 giorni consecutivi. Hai trasformato la disciplina in stile di vita.',
   'Star', 'epic', 500,
   '{"event_type": "streak_increment", "threshold": 30}'),

  ('streak_100',
   'Centurione',
   '100 giorni senza fermarsi. Sei una leggenda vivente.',
   'Crown', 'legendary', 1000,
   '{"event_type": "streak_increment", "threshold": 100}')

ON CONFLICT (id) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      rarity      = EXCLUDED.rarity,
      xp_reward   = EXCLUDED.xp_reward,
      criteria    = EXCLUDED.criteria;
