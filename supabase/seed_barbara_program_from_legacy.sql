-- Aplica no Supabase o treino legado da Barbara
-- (baseado no bloco comentado em src/db/index.ts).
--
-- Como usar:
-- 1) Ajuste o filtro da Barbara no CTE "barbara_profile" se necessário.
-- 2) Cole e rode inteiro no SQL Editor do Supabase.

begin;

-- 1) Localiza o perfil da Barbara.
with barbara_profile as (
  select id
  from public.profiles
  where lower(name) = lower('Barbara')
  limit 1
)
select
  case
    when exists (select 1 from barbara_profile) then 'OK: perfil Barbara encontrado'
    else 'ERRO: perfil Barbara nao encontrado em public.profiles'
  end as status;

-- 2) Garante que todos os exercicios do treino legado existam.
insert into public.exercises (name, primary_muscle, secondary_muscle, rest_seconds, scheme)
values
  ('Leg Press 45° Perna Aberta', 'adutor', 'gluteos', 120, '4x12'),
  ('Cadeira Extensora', 'quadriceps', null, 120, '4x10-12'),
  ('Agachamento Sumô', 'adutor', 'gluteos', 90, '3x12-15'),
  ('Afundo', 'gluteos', 'quadriceps', 90, '3x10 cada perna'),
  ('Abdutora 45°', 'gluteos', null, 90, '3x15-20'),

  ('Remada na Máquina', 'costas', 'biceps', 90, '3x10-12'),
  ('Graviton', 'costas', 'biceps', 120, '4x6-8'),
  ('Fly Inverso', 'ombro posterior', null, 90, '3x12-15'),
  ('Desenvolvimento no Banco', 'ombros', 'triceps', 90, '3x10-12'),
  ('Bíceps + Tríceps Máquina', 'bracos', null, 60, '3x12-15'),

  ('Lombar', 'lombar', 'gluteos', 90, '3x12-15'),
  ('Prancha', 'core', null, 60, '3x40-60s'),
  ('Abdominal Crunch', 'core', null, 60, '3x12-15'),
  ('Elevação de Pernas', 'core', null, 60, '3x10-12'),
  ('Panturrilha no Leg Press', 'panturrilha', null, 60, '4x15-20'),

  ('Stiff', 'posterior', 'gluteos', 120, '4x10-12'),
  ('Búlgaro', 'gluteos', 'quadriceps', 120, '3x8-10 cada perna'),
  ('Cadeira Flexora', 'posterior', null, 90, '3x10-12'),
  ('Supino na Máquina', 'peito', 'triceps', 90, '3x10-12'),
  ('Elevação Lateral', 'ombros', null, 60, '3x12-15')
on conflict (name) do update
set
  primary_muscle = excluded.primary_muscle,
  secondary_muscle = excluded.secondary_muscle,
  rest_seconds = excluded.rest_seconds,
  scheme = excluded.scheme,
  updated_at = now();

-- 3) Remove treinos atuais da Barbara para reconstruir com o programa legado.
with barbara_profile as (
  select id
  from public.profiles
  where lower(name) = lower('Barbara')
  limit 1
),
barbara_workouts as (
  select w.id
  from public.workouts w
  join barbara_profile p on p.id = w.user_id
)
delete from public.workout_exercises we
using barbara_workouts bw
where we.workout_id = bw.id;

with barbara_profile as (
  select id
  from public.profiles
  where lower(name) = lower('Barbara')
  limit 1
)
delete from public.workouts w
using barbara_profile p
where w.user_id = p.id;

-- 4) Cria os 5 treinos da semana da Barbara.
with barbara_profile as (
  select id
  from public.profiles
  where lower(name) = lower('Barbara')
  limit 1
)
insert into public.workouts (user_id, day_of_week, title)
select p.id, t.day_of_week, t.title
from barbara_profile p
cross join (
  values
    (1, 'Segunda – Inferior A'),
    (2, 'Terça – Superior A'),
    (3, 'Quarta – Core + Panturrilha'),
    (4, 'Quinta – Inferior B'),
    (5, 'Sexta – Superior B')
) as t(day_of_week, title);

-- 5) Vincula exercicios na ordem exata do treino legado.
with barbara_profile as (
  select id
  from public.profiles
  where lower(name) = lower('Barbara')
  limit 1
),
workout_map as (
  select w.id as workout_id, w.day_of_week
  from public.workouts w
  join barbara_profile p on p.id = w.user_id
),
exercise_order as (
  select *
  from (
    values
      (1, 0, 'Leg Press 45° Perna Aberta'),
      (1, 1, 'Cadeira Extensora'),
      (1, 2, 'Agachamento Sumô'),
      (1, 3, 'Afundo'),
      (1, 4, 'Abdutora 45°'),

      (2, 0, 'Remada na Máquina'),
      (2, 1, 'Graviton'),
      (2, 2, 'Fly Inverso'),
      (2, 3, 'Desenvolvimento no Banco'),
      (2, 4, 'Bíceps + Tríceps Máquina'),

      (3, 0, 'Lombar'),
      (3, 1, 'Prancha'),
      (3, 2, 'Abdominal Crunch'),
      (3, 3, 'Elevação de Pernas'),
      (3, 4, 'Panturrilha no Leg Press'),

      (4, 0, 'Stiff'),
      (4, 1, 'Búlgaro'),
      (4, 2, 'Cadeira Flexora'),
      (4, 3, 'Agachamento Sumô'),
      (4, 4, 'Abdutora 45°'),

      (5, 0, 'Graviton'),
      (5, 1, 'Supino na Máquina'),
      (5, 2, 'Elevação Lateral'),
      (5, 3, 'Fly Inverso'),
      (5, 4, 'Bíceps + Tríceps Máquina')
  ) as x(day_of_week, order_index, exercise_name)
)
insert into public.workout_exercises (workout_id, exercise_id, order_index)
select
  wm.workout_id,
  e.id as exercise_id,
  eo.order_index
from exercise_order eo
join workout_map wm on wm.day_of_week = eo.day_of_week
join public.exercises e on e.name = eo.exercise_name
order by wm.day_of_week, eo.order_index;

commit;

-- Validacao rapida:
-- select w.day_of_week, w.title, we.order_index, e.name
-- from public.workouts w
-- join public.profiles p on p.id = w.user_id
-- join public.workout_exercises we on we.workout_id = w.id
-- join public.exercises e on e.id = we.exercise_id
-- where lower(p.name) = lower('Barbara')
-- order by w.day_of_week, we.order_index;
