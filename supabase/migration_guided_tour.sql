-- Migration: guided tour for new users
-- Apply in the Supabase SQL Editor. Idempotent.
--
-- profiles.tours_seen lists the tours the user already went through
-- ('home', 'workout'). Accounts that exist when this migration runs already
-- know the app: they are marked as having seen every tour, only new accounts
-- get the tour. Users may update only this column of their own profile.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'tours_seen'
  ) then
    alter table public.profiles add column tours_seen text[] not null default '{}';
    update public.profiles set tours_seen = array['home', 'workout'];
  end if;
end $$;

grant update (tours_seen) on public.profiles to authenticated;
