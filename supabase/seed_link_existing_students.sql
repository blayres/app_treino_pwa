-- One-off: link Barbara Lorrine and Diandra to the admin's coach account
-- (Claudinho Personal, barbara.ayres.pro@gmail.com), as they were in the old
-- admin panel. Run once in the Supabase SQL Editor AFTER migration_coach.sql.
-- Idempotent: a student already linked (to this or another coach) is kept.

begin;

with coach as (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.auth_id
  where lower(u.email) = 'barbara.ayres.pro@gmail.com'
)
insert into public.coach_students (student_id, coach_id)
select s.id, coach.id
from public.profiles s
join auth.users u on u.id = s.auth_id
cross join coach
where s.id <> coach.id
  and (
    lower(u.email) = 'barbaralorrine@hotmail.com'
    or lower(u.email) like '%diandra%'
    or lower(s.name) like '%diandra%'
  )
on conflict (student_id) do nothing;

-- Check: students now linked to the coach (expect Barbara Lorrine and Diandra)
select s.id, s.name, u.email, cs.created_at
from public.coach_students cs
join public.profiles s on s.id = cs.student_id
join auth.users u on u.id = s.auth_id
join public.profiles c on c.id = cs.coach_id
join auth.users cu on cu.id = c.auth_id
where lower(cu.email) = 'barbara.ayres.pro@gmail.com'
order by s.name;

commit;
