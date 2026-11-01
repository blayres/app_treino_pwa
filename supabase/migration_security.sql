-- Migration: Security review — row-level security for every app table
-- Apply in the Supabase SQL Editor AFTER migration_onboarding.sql.
-- Idempotent: safe to run more than once.
--
-- Before: most tables had `using (true)` policies, so any signed-in user could
-- read and edit every other user's workouts, loads, sessions and attendance,
-- read all profiles, and even set their own profile role to 'admin'.
-- After: each user reads/writes only their own rows; admins (profiles.role =
-- 'admin') can read/write everything the admin panel needs.

begin;

-- ── Helpers (also created by migration_onboarding.sql) ─────────────────────
create or replace function public.current_profile_id()
returns bigint language sql stable security definer set search_path = public
as $$ select id from public.profiles where auth_id = auth.uid(); $$;

create or replace function public.current_profile_is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where auth_id = auth.uid() and role = 'admin'); $$;

revoke all on function public.current_profile_id() from public, anon;
revoke all on function public.current_profile_is_admin() from public, anon;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_profile_is_admin() to authenticated;

-- ── Drop every existing policy on the app tables ───────────────────────────
-- Production has policies that are not in the repo; permissive policies are
-- OR-ed together, so a single leftover `using (true)` would undo this review.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'exercises', 'workouts', 'workout_exercises',
        'exercise_loads', 'workout_sessions', 'attendance', 'exercise_load_history'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.exercise_loads enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.exercise_load_history enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (auth_id = auth.uid() or public.current_profile_is_admin());

-- The app creates the profile on first login if the auth trigger didn't.
create policy "profiles: insert own as student"
  on public.profiles for insert to authenticated
  with check (auth_id = auth.uid() and coalesce(role, 'student') = 'student');

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

-- Column privileges: users may change only their name and onboarding flag —
-- never `role` (privilege escalation) or `auth_id`.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (auth_id, name) on public.profiles to authenticated;
grant update (name, onboarded_at) on public.profiles to authenticated;

-- ── exercises (catalogue + private) ────────────────────────────────────────
create policy "exercises: read catalogue and own"
  on public.exercises for select to authenticated
  using (owner_id is null or owner_id = public.current_profile_id() or public.current_profile_is_admin());

create policy "exercises: insert own or admin catalogue"
  on public.exercises for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    or (owner_id is null and public.current_profile_is_admin())
  );

create policy "exercises: update own or admin catalogue"
  on public.exercises for update to authenticated
  using (owner_id = public.current_profile_id() or (owner_id is null and public.current_profile_is_admin()))
  with check (owner_id = public.current_profile_id() or (owner_id is null and public.current_profile_is_admin()));

create policy "exercises: delete own or admin catalogue"
  on public.exercises for delete to authenticated
  using (owner_id = public.current_profile_id() or (owner_id is null and public.current_profile_is_admin()));

-- ── Per-user tables: own rows, or admin ────────────────────────────────────
create policy "workouts: own or admin"
  on public.workouts for all to authenticated
  using (user_id = public.current_profile_id() or public.current_profile_is_admin())
  with check (user_id = public.current_profile_id() or public.current_profile_is_admin());

create policy "workout_exercises: own workouts or admin"
  on public.workout_exercises for all to authenticated
  using (
    public.current_profile_is_admin()
    or workout_id in (select id from public.workouts where user_id = public.current_profile_id())
  )
  with check (
    public.current_profile_is_admin()
    or workout_id in (select id from public.workouts where user_id = public.current_profile_id())
  );

create policy "exercise_loads: own or admin"
  on public.exercise_loads for all to authenticated
  using (user_id = public.current_profile_id() or public.current_profile_is_admin())
  with check (user_id = public.current_profile_id() or public.current_profile_is_admin());

create policy "workout_sessions: own or admin"
  on public.workout_sessions for all to authenticated
  using (user_id = public.current_profile_id() or public.current_profile_is_admin())
  with check (user_id = public.current_profile_id() or public.current_profile_is_admin());

create policy "attendance: own or admin"
  on public.attendance for all to authenticated
  using (user_id = public.current_profile_id() or public.current_profile_is_admin())
  with check (user_id = public.current_profile_id() or public.current_profile_is_admin());

create policy "exercise_load_history: own or admin"
  on public.exercise_load_history for all to authenticated
  using (user_id = public.current_profile_id() or public.current_profile_is_admin())
  with check (user_id = public.current_profile_id() or public.current_profile_is_admin());

-- ── Delete a private exercise ──────────────────────────────────────────────
-- Refuses if the exercise is in one of the user's ACTIVE workouts (the app
-- asks them to remove it first). Otherwise removes it from archived workouts
-- and deletes its loads/history, all in one transaction.
create or replace function public.delete_own_exercise(p_exercise_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint := public.current_profile_id();
begin
  if me is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (select 1 from public.exercises where id = p_exercise_id and owner_id = me) then
    raise exception 'EXERCISE_NOT_OWNED';
  end if;

  if exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.exercise_id = p_exercise_id and w.user_id = me and w.archived_at is null
  ) then
    raise exception 'EXERCISE_IN_USE';
  end if;

  delete from public.workout_exercises we
    using public.workouts w
    where w.id = we.workout_id and w.user_id = me and we.exercise_id = p_exercise_id;
  delete from public.exercise_loads where user_id = me and exercise_id = p_exercise_id;
  delete from public.exercise_load_history where user_id = me and exercise_id = p_exercise_id;
  delete from public.exercises where id = p_exercise_id and owner_id = me;
end;
$$;

revoke all on function public.delete_own_exercise(bigint) from public, anon;
grant execute on function public.delete_own_exercise(bigint) to authenticated;

commit;
