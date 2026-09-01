-- ============================================================
-- Progress screen: exercise_load_history table + RLS
-- Run once in Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS exercise_load_history (
  id          bigserial PRIMARY KEY,
  user_id     bigint    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id bigint    NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  load_kg     real      NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Fast queries per user ordered by date
CREATE INDEX IF NOT EXISTS idx_exercise_load_history_user_date
  ON exercise_load_history (user_id, recorded_at DESC);

-- Row-Level Security: users can only read and insert their own rows
ALTER TABLE exercise_load_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own load history"
  ON exercise_load_history FOR SELECT
  USING (user_id = (
    SELECT id FROM profiles WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users can insert own load history"
  ON exercise_load_history FOR INSERT
  WITH CHECK (user_id = (
    SELECT id FROM profiles WHERE auth_id = auth.uid()
  ));
