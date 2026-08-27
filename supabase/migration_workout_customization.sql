-- Migration: Workout Customization
-- Adds soft-delete (archive) support to workouts so historical sessions are preserved.
-- Also removes the old unique(user_id, day_of_week) constraint and replaces it with a
-- partial unique index that only enforces uniqueness for active (non-archived) workouts.

-- 1. Add archived_at column (NULL = active, non-NULL = archived)
alter table workouts add column if not exists archived_at timestamptz default null;

-- 2. Drop the old hard unique constraint on (user_id, day_of_week)
--    (Supabase/Postgres: constraint name matches what CREATE TABLE generated)
alter table workouts drop constraint if exists workouts_user_id_day_of_week_key;

-- 3. Create a partial unique index — only one ACTIVE workout per user per day of week
create unique index if not exists workouts_user_day_active_unique
  on workouts (user_id, day_of_week)
  where archived_at is null;

-- 4. Add exercises.tip column if missing (some schemas may not have it)
alter table exercises add column if not exists tip text default null;

-- 5. RLS: allow each signed-in user to edit only their own workouts and exercises.
-- The previous version only documented these policies, so installations that had
-- read-only policies could display workouts but every edit would be rejected.
drop policy if exists "users manage own workouts" on workouts;
create policy "users manage own workouts"
  on workouts for all to authenticated
  using (
    user_id in (select id from profiles where auth_id = auth.uid())
  )
  with check (
    user_id in (select id from profiles where auth_id = auth.uid())
  );

drop policy if exists "users manage own workout exercises" on workout_exercises;
create policy "users manage own workout exercises"
  on workout_exercises for all to authenticated
  using (
    workout_id in (
      select id from workouts
      where user_id in (select id from profiles where auth_id = auth.uid())
    )
  )
  with check (
    workout_id in (
      select id from workouts
      where user_id in (select id from profiles where auth_id = auth.uid())
    )
  );
