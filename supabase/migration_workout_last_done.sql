-- Migration: "last done" per workout computed in the database
-- Apply in the Supabase SQL Editor. Idempotent.
--
-- Home showed "feito há N dias" by downloading EVERY completed session of the
-- user and taking the latest per workout in the app (grows forever: ~780 rows
-- after 3 years). This view returns one row per workout instead.
--
-- security_invoker = true → the caller's RLS on workout_sessions applies, so a
-- user only ever sees their own rows (admins see what their policy allows).

begin;

create or replace view public.workout_last_done
with (security_invoker = true) as
select
  user_id,
  workout_id,
  max(ended_at) as last_done
from public.workout_sessions
where completed = 1
  and ended_at is not null
group by user_id, workout_id;

revoke all on public.workout_last_done from anon;
grant select on public.workout_last_done to authenticated;

-- Fast aggregation per user (also speeds up the history in the admin panel).
create index if not exists workout_sessions_user_completed_idx
  on public.workout_sessions (user_id, workout_id, ended_at desc)
  where completed = 1;

commit;
