-- Migration: merge duplicate catalogue exercises
-- (names that differ only by case/surrounding spaces, e.g.
-- "Cadeira Extensora" / "Cadeira extensora").
--
-- 1. Run the PREVIEW query alone first to see what will be merged.
-- 2. Then run everything from `begin;` to `commit;`. It is one transaction:
--    if anything fails, nothing changes.
--
-- For each group the kept row is: the one with an animation
-- (exercise_library_id), then the most used in workouts, then the oldest id.
-- Every reference (workouts, loads, load history) moves to the kept row.
-- When a user has loads on both rows, the most recently updated one wins.

-- ── PREVIEW (read-only) ─────────────────────────────────────────────────────
-- with ranked as (
--   select e.id, e.name, lower(btrim(e.name)) as key,
--     row_number() over (
--       partition by lower(btrim(e.name))
--       order by (e.exercise_library_id is not null) desc,
--                (select count(*) from public.workout_exercises we where we.exercise_id = e.id) desc,
--                e.id
--     ) as rn
--   from public.exercises e
--   where e.owner_id is null
-- )
-- select key, array_agg(id || ': ' || name || case when rn = 1 then ' (mantido)' else '' end order by rn) as exercicios
-- from ranked
-- group by key
-- having count(*) > 1;

begin;

create temp table exercise_merge on commit drop as
with ranked as (
  select e.id, lower(btrim(e.name)) as key,
    row_number() over (
      partition by lower(btrim(e.name))
      order by (e.exercise_library_id is not null) desc,
               (select count(*) from public.workout_exercises we where we.exercise_id = e.id) desc,
               e.id
    ) as rn
  from public.exercises e
  where e.owner_id is null
)
select d.id as dup_id, k.id as keep_id
from ranked d
join ranked k on k.key = d.key and k.rn = 1
where d.rn > 1;

-- Keep useful data from duplicates if the kept row lacks it.
update public.exercises k
set exercise_library_id = coalesce(k.exercise_library_id, d.exercise_library_id),
    tip = coalesce(k.tip, d.tip),
    primary_muscle = coalesce(k.primary_muscle, d.primary_muscle),
    secondary_muscle = coalesce(k.secondary_muscle, d.secondary_muscle)
from exercise_merge m
join public.exercises d on d.id = m.dup_id
where k.id = m.keep_id;

-- Workouts: point to the kept exercise, then drop a repeated exercise inside
-- the same workout (if a workout had both spellings).
update public.workout_exercises we
set exercise_id = m.keep_id
from exercise_merge m
where we.exercise_id = m.dup_id;

delete from public.workout_exercises a
using public.workout_exercises b
where a.workout_id = b.workout_id
  and a.exercise_id = b.exercise_id
  and a.id > b.id
  and a.exercise_id in (select keep_id from exercise_merge);

-- Loads: unique (user_id, exercise_id).
-- a) the user has loads on the kept row too → keep the most recent values
update public.exercise_loads k
set load_kg = d.load_kg, progression_kg = d.progression_kg, updated_at = d.updated_at
from public.exercise_loads d
join exercise_merge m on m.dup_id = d.exercise_id
where k.exercise_id = m.keep_id
  and k.user_id = d.user_id
  and d.updated_at > k.updated_at;

delete from public.exercise_loads d
using exercise_merge m
where d.exercise_id = m.dup_id
  and exists (
    select 1 from public.exercise_loads k
    where k.user_id = d.user_id and k.exercise_id = m.keep_id
  );

-- b) several duplicates for the same user and no kept row → keep the newest
delete from public.exercise_loads d
using exercise_merge m
where d.exercise_id = m.dup_id
  and exists (
    select 1
    from public.exercise_loads d2
    join exercise_merge m2 on m2.dup_id = d2.exercise_id
    where m2.keep_id = m.keep_id
      and d2.user_id = d.user_id
      and (d2.updated_at > d.updated_at or (d2.updated_at = d.updated_at and d2.id > d.id))
  );

update public.exercise_loads d
set exercise_id = m.keep_id
from exercise_merge m
where d.exercise_id = m.dup_id;

-- Load history: simply re-point (no uniqueness).
update public.exercise_load_history h
set exercise_id = m.keep_id
from exercise_merge m
where h.exercise_id = m.dup_id;

-- Remove the duplicates. Any other table still referencing them makes this
-- fail and the whole transaction rolls back.
delete from public.exercises e
using exercise_merge m
where e.id = m.dup_id;

-- From now on the catalogue rejects names that differ only by case.
drop index if exists public.exercises_global_name_unique;
create unique index exercises_global_name_unique
  on public.exercises (lower(btrim(name))) where owner_id is null;

commit;
