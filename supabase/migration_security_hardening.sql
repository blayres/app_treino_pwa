-- Migration: security hardening (after audit_security.sql, 2026-11-01)
-- Apply in the Supabase SQL Editor AFTER migration_security.sql. Idempotent.
--
-- Findings fixed:
-- 1. CRITICAL: seed_default_workouts_for_user(p_profile_id) was SECURITY DEFINER,
--    without search_path, and executable by anon/authenticated: anyone could write
--    the default program into ANY profile. Unused by the app → dropped (with its
--    unused trigger function).
-- 2. anon/authenticated had ALL privileges (incl. TRUNCATE, which bypasses RLS)
--    on every table. RLS blocked the API, but one dropped policy would expose
--    everything. Now: anon can only read exercise_library; authenticated keeps
--    only SELECT/INSERT/UPDATE/DELETE (RLS still decides which rows).
-- 3. is_admin() callable by anon; set_updated_at without search_path.
-- 4. Duplicate read policy on exercise_library; leftover backup table exposed.
-- 5. Future tables/functions no longer get privileges for anon by default.

begin;

-- ── 1. Dangerous unused functions ───────────────────────────────────────────
drop function if exists public.seed_default_workouts_for_user(bigint);
drop function if exists public.trigger_seed_default_workouts();

-- ── 2. Table privileges ─────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'exercises', 'workouts', 'workout_exercises', 'exercise_loads',
    'workout_sessions', 'attendance', 'exercise_load_history', 'exercise_library'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon', t);
      execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
    end if;
  end loop;
end $$;

-- Catalogue of animations: public read only (writes only via service role scripts).
grant select on public.exercise_library to anon, authenticated;
revoke insert, update, delete on public.exercise_library from authenticated;

-- profiles: rows are created by the auth trigger (or the app on first login) and
-- deleted only through delete_own_account(); column grants from
-- migration_security.sql still limit INSERT/UPDATE to auth_id/name/onboarded_at.
revoke delete on public.profiles from authenticated;

-- Leftover backup table: nobody but the service role needs it.
-- (Drop it if no longer needed: drop table public.exercises_backup_before_gif_audit;)
do $$
begin
  if to_regclass('public.exercises_backup_before_gif_audit') is not null then
    execute 'revoke all on public.exercises_backup_before_gif_audit from anon, authenticated';
  end if;
end $$;

-- ── 3. Functions ────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.is_admin()') is not null then
    execute 'revoke all on function public.is_admin() from public, anon';
    execute 'grant execute on function public.is_admin() to authenticated';
  end if;
  -- Trigger functions (handle_new_auth_user, set_updated_at) are not exposed by the
  -- API (they return `trigger`), so their EXECUTE grants are left untouched to avoid
  -- any risk to signups/updates; only pin set_updated_at's search_path.
  if to_regprocedure('public.set_updated_at()') is not null then
    execute 'alter function public.set_updated_at() set search_path = public';
  end if;
end $$;

-- ── 4. Duplicate policy ─────────────────────────────────────────────────────
drop policy if exists "Allow public read exercise_library" on public.exercise_library;
drop policy if exists "exercise_library_public_read" on public.exercise_library;
create policy "exercise_library_public_read"
  on public.exercise_library for select to anon, authenticated
  using (true);

-- ── 5. Defaults for objects created later in public ─────────────────────────
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from public, anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;

commit;
