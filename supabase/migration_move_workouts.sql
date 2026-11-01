-- Migration: move workouts to other weekdays in place (drag & drop in "Meu treino")
-- Apply in the Supabase SQL Editor. Idempotent.
--
-- Swapping Monday ↔ Tuesday used to archive both workouts and create new ones,
-- so "feito há…" and the session history were detached from the moved day.
-- move_workouts([{ "id": 12, "day": 2 }, { "id": 15, "day": 1 }]) changes
-- day_of_week of the same rows, atomically. The one-active-workout-per-weekday
-- index only covers non-archived rows, so the moved rows are archived for a
-- moment inside the transaction to free their weekdays.
--
-- SECURITY INVOKER: the caller's RLS applies (own workouts, or admin).

create or replace function public.move_workouts(p_moves jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  m jsonb;
begin
  for m in select * from jsonb_array_elements(p_moves) loop
    update public.workouts
      set archived_at = now()
      where id = (m->>'id')::bigint and archived_at is null;
    if not found then
      raise exception 'WORKOUT_NOT_FOUND %', m->>'id';
    end if;
  end loop;

  for m in select * from jsonb_array_elements(p_moves) loop
    update public.workouts
      set day_of_week = (m->>'day')::int, archived_at = null
      where id = (m->>'id')::bigint;
  end loop;
end;
$$;

revoke all on function public.move_workouts(jsonb) from public, anon;
grant execute on function public.move_workouts(jsonb) to authenticated;
