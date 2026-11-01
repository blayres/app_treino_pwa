-- Migration: Onboarding + custom exercises
-- Apply in the Supabase SQL Editor (idempotent: safe to run more than once).
--
-- 1. profiles.onboarded_at  → new accounts go through /onboarding; existing
--    accounts are marked as already onboarded.
-- 2. exercises.owner_id     → NULL = global catalogue, otherwise a private
--    exercise visible only to the profile that created it.
-- 3. workout_exercises.scheme / rest_seconds → per-workout overrides, so an
--    imported "5x5" doesn't change the shared catalogue exercise.
-- 4. RLS on exercises: everyone reads the catalogue + own exercises; users
--    write only their own; admins manage the global catalogue.
-- 5. delete_own_account() also removes the user's private exercises.

-- ── 1. Onboarding flag ──────────────────────────────────────────────────────
alter table public.profiles add column if not exists onboarded_at timestamptz default null;

-- Existing accounts already have a program: never show them the onboarding.
-- (Runs only for rows that predate this migration; new rows stay NULL.)
do $$
begin
  if not exists (select 1 from public.profiles where onboarded_at is not null) then
    update public.profiles set onboarded_at = now() where onboarded_at is null;
  end if;
end $$;

-- New accounts must start with no workouts so they see /onboarding. Production
-- had a trigger (not previously in the repo) that copied the default program
-- for every new profile; the app now does that only if the user picks
-- "Usar treino pronto". The profile itself is still created by the
-- on_auth_user_created trigger on auth.users.
drop trigger if exists on_profile_created on public.profiles;

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.current_profile_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_id = auth.uid();
$$;

create or replace function public.current_profile_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where auth_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.current_profile_id() from public, anon;
revoke all on function public.current_profile_is_admin() from public, anon;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_profile_is_admin() to authenticated;

-- ── 2. Private exercises ────────────────────────────────────────────────────
alter table public.exercises
  add column if not exists owner_id bigint references public.profiles(id) on delete cascade;

-- Names were globally unique; now they are unique within the global catalogue
-- and within each user's private exercises.
-- The catalogue keeps the previous case-sensitive rule: it already contains
-- names that differ only by case (e.g. "Cadeira Extensora" / "Cadeira extensora").
-- Private exercises are new, so they get the stricter case-insensitive rule.
alter table public.exercises drop constraint if exists exercises_name_key;
-- (migration_merge_duplicate_exercises.sql later replaces this with a
-- case-insensitive index; `if not exists` keeps a re-run from reverting it.)
create unique index if not exists exercises_global_name_unique
  on public.exercises (name) where owner_id is null;
create unique index if not exists exercises_owner_name_unique
  on public.exercises (owner_id, lower(name)) where owner_id is not null;

-- ── 3. Per-workout overrides ────────────────────────────────────────────────
alter table public.workout_exercises add column if not exists scheme text default null;
alter table public.workout_exercises add column if not exists rest_seconds int default null;

-- ── 4. RLS on exercises ─────────────────────────────────────────────────────
-- Previously "authenticated rw exercises" let ANY signed-in user edit or delete
-- ANY exercise, including the global catalogue.
drop policy if exists "authenticated rw exercises" on public.exercises;
drop policy if exists "authenticated read exercises" on public.exercises;
drop policy if exists "read catalogue and own exercises" on public.exercises;
drop policy if exists "insert own exercises" on public.exercises;
drop policy if exists "update own exercises" on public.exercises;
drop policy if exists "delete own exercises" on public.exercises;

create policy "read catalogue and own exercises"
  on public.exercises for select to authenticated
  using (owner_id is null or owner_id = public.current_profile_id());

create policy "insert own exercises"
  on public.exercises for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    or (owner_id is null and public.current_profile_is_admin())
  );

create policy "update own exercises"
  on public.exercises for update to authenticated
  using (
    owner_id = public.current_profile_id()
    or (owner_id is null and public.current_profile_is_admin())
  )
  with check (
    owner_id = public.current_profile_id()
    or (owner_id is null and public.current_profile_is_admin())
  );

create policy "delete own exercises"
  on public.exercises for delete to authenticated
  using (
    owner_id = public.current_profile_id()
    or (owner_id is null and public.current_profile_is_admin())
  );

-- ── 5. Account deletion also removes private exercises ─────────────────────
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_auth_id uuid := auth.uid();
  current_profile_id bigint;
begin
  if current_auth_id is null then
    raise exception 'Authentication is required';
  end if;

  select id into current_profile_id
  from public.profiles
  where auth_id = current_auth_id;

  if current_profile_id is not null then
    delete from public.workout_sessions where user_id = current_profile_id;
    delete from public.exercise_loads where user_id = current_profile_id;
    if to_regclass('public.exercise_load_history') is not null then
      execute 'delete from public.exercise_load_history where user_id = $1' using current_profile_id;
    end if;
    delete from public.attendance where user_id = current_profile_id;
    delete from public.workouts where user_id = current_profile_id;
    delete from public.exercises where owner_id = current_profile_id;
    delete from public.profiles where id = current_profile_id;
  end if;

  delete from auth.users where id = current_auth_id;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
