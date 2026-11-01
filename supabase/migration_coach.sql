-- Migration: personal trainers (coaches) and their students
-- Apply in the Supabase SQL Editor AFTER migration_security.sql. Idempotent.
--
-- Any user can become a coach ("Área do personal"): they get an invite code
-- (profiles.coach_code). A student joins with the code / invite link and is
-- linked in coach_students (one coach per student). The coach then reads the
-- student's data and builds/edits their program; the student can still edit
-- it too. Admin (profiles.role = 'admin') keeps its global access.
--
-- Writes to coach_students happen only through join_coach() (insert) or a
-- delete by either side (unlink). Coaches never get access to students that
-- are not linked to them.

begin;

-- ── Invite code ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists coach_code text;
create unique index if not exists profiles_coach_code_key on public.profiles (coach_code) where coach_code is not null;

-- ── Link table ──────────────────────────────────────────────────────────────
create table if not exists public.coach_students (
  student_id bigint primary key references public.profiles(id) on delete cascade,
  coach_id bigint not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint coach_students_not_self check (student_id <> coach_id)
);
create index if not exists coach_students_coach_idx on public.coach_students (coach_id);

alter table public.coach_students enable row level security;
revoke all on public.coach_students from anon, authenticated;
grant select, delete on public.coach_students to authenticated;

drop policy if exists "coach_students: read own links" on public.coach_students;
create policy "coach_students: read own links"
  on public.coach_students for select to authenticated
  using (
    coach_id = public.current_profile_id()
    or student_id = public.current_profile_id()
    or public.current_profile_is_admin()
  );

-- Either side can end the link (coach removes the student / student leaves).
drop policy if exists "coach_students: unlink own" on public.coach_students;
create policy "coach_students: unlink own"
  on public.coach_students for delete to authenticated
  using (coach_id = public.current_profile_id() or student_id = public.current_profile_id());

-- ── Helper used by the policies ─────────────────────────────────────────────
create or replace function public.is_coach_of(p_student_id bigint)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.coach_students
    where student_id = p_student_id and coach_id = public.current_profile_id()
  );
$$;
revoke all on function public.is_coach_of(bigint) from public, anon;
grant execute on function public.is_coach_of(bigint) to authenticated;

-- ── RPCs ────────────────────────────────────────────────────────────────────
-- Code alphabet without look-alikes (0/O, 1/I/L).
create or replace function public.new_coach_code()
returns text language plpgsql volatile set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where coach_code = code);
  end loop;
  return code;
end;
$$;
revoke all on function public.new_coach_code() from public, anon, authenticated;

-- Become a coach (or get the existing code). p_reset = true makes a new code
-- (the old link stops working; already linked students stay).
create or replace function public.become_coach(p_reset boolean default false)
returns text language plpgsql security definer set search_path = public
as $$
declare
  me bigint := public.current_profile_id();
  code text;
begin
  if me is null then
    raise exception 'Authentication is required';
  end if;
  select coach_code into code from public.profiles where id = me;
  if code is null or p_reset then
    code := public.new_coach_code();
    update public.profiles set coach_code = code where id = me;
  end if;
  return code;
end;
$$;
revoke all on function public.become_coach(boolean) from public, anon;
grant execute on function public.become_coach(boolean) to authenticated;

-- Name of the coach behind an invite code (shown before joining).
create or replace function public.coach_invite_name(p_code text)
returns text language sql stable security definer set search_path = public
as $$
  select name from public.profiles
  where coach_code = upper(btrim(p_code)) and auth.uid() is not null;
$$;
revoke all on function public.coach_invite_name(text) from public, anon;
grant execute on function public.coach_invite_name(text) to authenticated;

-- Join a coach (replaces a previous coach). Returns the coach's name.
create or replace function public.join_coach(p_code text)
returns text language plpgsql security definer set search_path = public
as $$
declare
  me bigint := public.current_profile_id();
  coach record;
begin
  if me is null then
    raise exception 'Authentication is required';
  end if;
  select id, name into coach from public.profiles where coach_code = upper(btrim(p_code));
  if coach.id is null then
    raise exception 'INVALID_COACH_CODE';
  end if;
  if coach.id = me then
    raise exception 'OWN_COACH_CODE';
  end if;
  insert into public.coach_students (student_id, coach_id)
    values (me, coach.id)
    on conflict (student_id) do update set coach_id = excluded.coach_id, created_at = now();
  return coach.name;
end;
$$;
revoke all on function public.join_coach(text) from public, anon;
grant execute on function public.join_coach(text) to authenticated;

-- The current user's coach (students can't read other profiles directly).
create or replace function public.my_coach()
returns table (coach_id bigint, coach_name text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name
  from public.coach_students cs
  join public.profiles p on p.id = cs.coach_id
  where cs.student_id = public.current_profile_id();
$$;
revoke all on function public.my_coach() from public, anon;
grant execute on function public.my_coach() to authenticated;

-- ── Coach access to the students' data (extra permissive policies) ─────────
drop policy if exists "profiles: coach reads students" on public.profiles;
create policy "profiles: coach reads students"
  on public.profiles for select to authenticated
  using (public.is_coach_of(id));

drop policy if exists "workouts: coach manages students" on public.workouts;
create policy "workouts: coach manages students"
  on public.workouts for all to authenticated
  using (public.is_coach_of(user_id))
  with check (public.is_coach_of(user_id));

drop policy if exists "workout_exercises: coach manages students" on public.workout_exercises;
create policy "workout_exercises: coach manages students"
  on public.workout_exercises for all to authenticated
  using (workout_id in (select id from public.workouts where public.is_coach_of(user_id)))
  with check (workout_id in (select id from public.workouts where public.is_coach_of(user_id)));

-- Exercises the coach creates while building a student's program belong to
-- the student (so the student always sees them).
drop policy if exists "exercises: coach manages students' own" on public.exercises;
create policy "exercises: coach manages students' own"
  on public.exercises for all to authenticated
  using (owner_id is not null and public.is_coach_of(owner_id))
  with check (owner_id is not null and public.is_coach_of(owner_id));

-- Training data: read only for the coach.
drop policy if exists "exercise_loads: coach reads students" on public.exercise_loads;
create policy "exercise_loads: coach reads students"
  on public.exercise_loads for select to authenticated
  using (public.is_coach_of(user_id));

drop policy if exists "workout_sessions: coach reads students" on public.workout_sessions;
create policy "workout_sessions: coach reads students"
  on public.workout_sessions for select to authenticated
  using (public.is_coach_of(user_id));

drop policy if exists "attendance: coach reads students" on public.attendance;
create policy "attendance: coach reads students"
  on public.attendance for select to authenticated
  using (public.is_coach_of(user_id));

drop policy if exists "exercise_load_history: coach reads students" on public.exercise_load_history;
create policy "exercise_load_history: coach reads students"
  on public.exercise_load_history for select to authenticated
  using (public.is_coach_of(user_id));

-- ── delete_own_exercise: the coach may delete a student's private exercise ─
-- Same rules as before (refused while in an active workout of the owner).
create or replace function public.delete_own_exercise(p_exercise_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint := public.current_profile_id();
  owner bigint;
begin
  if me is null then
    raise exception 'Authentication is required';
  end if;

  select owner_id into owner from public.exercises where id = p_exercise_id;
  if owner is null or (owner <> me and not public.is_coach_of(owner)) then
    raise exception 'EXERCISE_NOT_OWNED';
  end if;

  if exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.exercise_id = p_exercise_id and w.user_id = owner and w.archived_at is null
  ) then
    raise exception 'EXERCISE_IN_USE';
  end if;

  delete from public.workout_exercises we
    using public.workouts w
    where w.id = we.workout_id and w.user_id = owner and we.exercise_id = p_exercise_id;
  delete from public.exercise_loads where user_id = owner and exercise_id = p_exercise_id;
  delete from public.exercise_load_history where user_id = owner and exercise_id = p_exercise_id;
  delete from public.exercises where id = p_exercise_id and owner_id = owner;
end;
$$;
revoke all on function public.delete_own_exercise(bigint) from public, anon;
grant execute on function public.delete_own_exercise(bigint) to authenticated;

commit;
