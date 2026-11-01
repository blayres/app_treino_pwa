-- Migration: per-workout exercise notes
-- Coach sheets carry instructions that don't fit in "4x10" (cadence, drop-sets,
-- supersets…). They are stored per exercise of each workout and shown in the
-- workout screen in place of the catalogue tip.
-- Apply in the Supabase SQL Editor. Idempotent.
alter table public.workout_exercises add column if not exists notes text default null;
