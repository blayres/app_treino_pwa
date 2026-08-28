-- Apply in the Supabase SQL Editor. It enables a user to update only their own
-- display name and exposes a narrowly scoped, authenticated account deletion RPC.

create policy "authenticated update own profile"
  on public.profiles for update to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_auth_id uuid := auth.uid();
  current_profile_id bigint;
begin
  if current_auth_id is null then
    raise exception 'Authentication is required';
  end if;

  select id into current_profile_id
  from public.profiles
  where auth_id = current_auth_id;

  if current_profile_id is not null then
    delete from public.workout_sessions where user_id = current_profile_id;
    delete from public.exercise_loads where user_id = current_profile_id;
    delete from public.attendance where user_id = current_profile_id;
    delete from public.workouts where user_id = current_profile_id;
    delete from public.profiles where id = current_profile_id;
  end if;

  delete from auth.users where id = current_auth_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
