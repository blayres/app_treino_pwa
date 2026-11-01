-- Migration: "time to update your workout" reminder
-- Apply in the Supabase SQL Editor. Idempotent.
--
-- The app reminds the user to renew their program after 2 calendar months with
-- at least 14 trained days each (attendance) since the current program cycle
-- started. The cycle restarts when the program is updated or the user says
-- they already updated it; "Lembrar depois" snoozes the reminder.

alter table public.profiles
  add column if not exists program_cycle_started_at timestamptz not null default now();
alter table public.profiles
  add column if not exists program_reminder_snoozed_until timestamptz default null;

-- Users may update only these columns of their own profile (see
-- migration_security.sql: column-level grants + "profiles: update own").
grant update (program_cycle_started_at, program_reminder_snoozed_until) on public.profiles to authenticated;
