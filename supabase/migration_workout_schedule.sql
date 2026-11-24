-- Migration: programs without fixed weekdays ("Em sequência")
-- Apply in the Supabase SQL Editor BEFORE deploying the app version that uses it.
-- Idempotent: safe to run again.
--
-- Not everyone trains Monday to Friday. A program can now be:
--   'week'     each workout has a weekday (day_of_week = 1 Monday … 7 Sunday);
--   'sequence' workouts done in order on any day (day_of_week = position 1…7),
--              the app suggests the one after the last completed.
-- day_of_week keeps its role as the slot, so the one-active-workout-per-slot
-- index and move_workouts() keep working for both modes.
--
-- The mode lives on each workout (all active workouts of a user share it) so a
-- coach, who manages the student's workouts but not their profile, can change it.
-- RLS: the existing workouts policies apply (owner, coach of the owner, admin).
--
-- Undo: alter table public.workouts drop column if exists schedule;

alter table public.workouts
  add column if not exists schedule text not null default 'week';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workouts_schedule_check') then
    alter table public.workouts
      add constraint workouts_schedule_check check (schedule in ('week', 'sequence'));
  end if;
end $$;

comment on column public.workouts.schedule is
  'week = day_of_week is a weekday (1 Mon … 7 Sun); sequence = day_of_week is the position in the rotation.';
