-- Migration: personal trainers' own exercise videos
-- NOT APPLIED YET — the feature is off (FEATURES.coachVideos) until video
-- hosting fits the budget. Apply this, then flip the flag, to enable it.
-- Apply in the Supabase SQL Editor AFTER migration_coach.sql. Idempotent.
--
-- A coach records how they teach an exercise and uploads the video; their
-- students see it instead of the library animation. One video per coach per
-- exercise (replacing uploads a new file and removes the old one).
--
-- Files: private Storage bucket "exercise-videos", path "<coach profile id>/…".
-- Only the coach (owner folder) uploads/deletes; the coach and their students
-- can read (the app asks for short-lived signed URLs, on demand).
-- Limits: 50 MB per file (Supabase free plan maximum), mp4 / mov / webm.

begin;

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.current_profile_is_coach()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = public.current_profile_id() and coach_code is not null
  );
$$;
revoke all on function public.current_profile_is_coach() from public, anon;
grant execute on function public.current_profile_is_coach() to authenticated;

-- True if p_coach_id (as text: Storage folders are text) is the current user's coach.
create or replace function public.is_my_coach(p_coach_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.coach_students
    where student_id = public.current_profile_id() and coach_id::text = p_coach_id
  );
$$;
revoke all on function public.is_my_coach(text) from public, anon;
grant execute on function public.is_my_coach(text) to authenticated;

-- ── Table ──────────────────────────────────────────────────────────────────
create table if not exists public.exercise_videos (
  id bigint generated always as identity primary key,
  coach_id bigint not null references public.profiles(id) on delete cascade,
  exercise_id bigint not null references public.exercises(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint exercise_videos_one_per_exercise unique (coach_id, exercise_id)
);

alter table public.exercise_videos enable row level security;
revoke all on public.exercise_videos from anon, authenticated;
grant select, insert, update, delete on public.exercise_videos to authenticated;

drop policy if exists "exercise_videos: coach and students read" on public.exercise_videos;
create policy "exercise_videos: coach and students read"
  on public.exercise_videos for select to authenticated
  using (coach_id = public.current_profile_id() or public.is_my_coach(coach_id::text));

drop policy if exists "exercise_videos: coach manages own" on public.exercise_videos;
create policy "exercise_videos: coach manages own"
  on public.exercise_videos for all to authenticated
  using (coach_id = public.current_profile_id())
  with check (
    coach_id = public.current_profile_id()
    and public.current_profile_is_coach()
    and storage_path like public.current_profile_id()::text || '/%'
  );

-- ── Storage bucket (private) ───────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-videos', 'exercise-videos', false, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "exercise-videos: coach uploads own" on storage.objects;
create policy "exercise-videos: coach uploads own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'exercise-videos'
    and (storage.foldername(name))[1] = public.current_profile_id()::text
    and public.current_profile_is_coach()
  );

drop policy if exists "exercise-videos: coach updates own" on storage.objects;
create policy "exercise-videos: coach updates own"
  on storage.objects for update to authenticated
  using (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = public.current_profile_id()::text)
  with check (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = public.current_profile_id()::text);

drop policy if exists "exercise-videos: coach deletes own" on storage.objects;
create policy "exercise-videos: coach deletes own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = public.current_profile_id()::text);

drop policy if exists "exercise-videos: coach and students read" on storage.objects;
create policy "exercise-videos: coach and students read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'exercise-videos'
    and (
      (storage.foldername(name))[1] = public.current_profile_id()::text
      or public.is_my_coach((storage.foldername(name))[1])
    )
  );

commit;
