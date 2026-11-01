-- Migration: exercise substitutes ("Ver substitutos" in the workout screen)
-- Apply in the Supabase SQL Editor AFTER migration_merge_duplicate_exercises.sql.
-- Idempotent: safe to run again (new rows are skipped if they already exist).
--
-- 1. exercise_substitutes: curated alternatives per catalogue exercise, ranked
--    (1 = best). Prefer a DIFFERENT EQUIPMENT for the same muscle, because the
--    usual reason to substitute is a busy machine.
-- 2. ~25 common gym exercises added to the global catalogue so every muscle has
--    dumbbell/cable/bodyweight options, linked to the animation library when an
--    exact name exists there.
-- 3. The curated pairs. Exercises without curated rows (e.g. the user's own)
--    get substitutes by muscle in the app.

begin;

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists public.exercise_substitutes (
  exercise_id bigint not null references public.exercises(id) on delete cascade,
  substitute_id bigint not null references public.exercises(id) on delete cascade,
  rank smallint not null default 1,
  primary key (exercise_id, substitute_id),
  check (exercise_id <> substitute_id)
);

alter table public.exercise_substitutes enable row level security;
drop policy if exists "exercise_substitutes: read" on public.exercise_substitutes;
drop policy if exists "exercise_substitutes: admin writes" on public.exercise_substitutes;
create policy "exercise_substitutes: read"
  on public.exercise_substitutes for select to authenticated
  using (true);
create policy "exercise_substitutes: admin writes"
  on public.exercise_substitutes for all to authenticated
  using (public.current_profile_is_admin())
  with check (public.current_profile_is_admin());

revoke all on public.exercise_substitutes from anon;
grant select, insert, update, delete on public.exercise_substitutes to authenticated;

-- ── 2. New catalogue exercises ──────────────────────────────────────────────
with new_exercises (name, primary_muscle, secondary_muscle, rest_seconds, scheme, library_name) as (
  values
    ('Supino reto com halteres',      'peito',           'triceps',    90,  '3x10-12', 'Dumbbell Bench Press'),
    ('Flexão de braço',               'peito',           'triceps',    60,  '3x12-15', 'Pushups'),
    ('Crucifixo com halteres',        'peito',           null,         60,  '3x12-15', 'Dumbbell Flyes'),
    ('Crossover na polia',            'peito',           null,         60,  '3x12-15', 'Cable Crossover'),
    ('Remada unilateral com halter',  'costas',          'biceps',     60,  '3x10-12', 'One-Arm Dumbbell Row'),
    ('Remada baixa na polia',         'costas',          'biceps',     90,  '3x10-12', 'Seated Cable Rows'),
    ('Puxada frente na polia',        'costas',          'biceps',     90,  '3x10-12', 'Wide-Grip Lat Pulldown'),
    ('Desenvolvimento com halteres',  'ombros',          'triceps',    90,  '3x10-12', 'Dumbbell Shoulder Press'),
    ('Elevação lateral na polia',     'ombros',          null,         60,  '3x12-15', null),
    ('Face pull na polia',            'ombro posterior', null,         60,  '3x12-15', 'Face Pull'),
    ('Rosca alternada com halteres',  'biceps',          null,         60,  '3x10-12', 'Dumbbell Alternate Bicep Curl'),
    ('Rosca direta com barra',        'biceps',          null,         60,  '3x10-12', 'Barbell Curl'),
    ('Tríceps francês com halter',    'triceps',         null,         60,  '3x10-12', 'Standing Dumbbell Triceps Extension'),
    ('Mergulho no banco',             'triceps',         null,         60,  '3x12-15', 'Bench Dips'),
    ('Agachamento goblet',            'quadriceps',      'gluteos',    90,  '3x10-12', 'Goblet Squat'),
    ('Agachamento hack',              'quadriceps',      'gluteos',    120, '4x10-12', 'Hack Squat'),
    ('Stiff com halteres',            'posterior',       'gluteos',    90,  '3x10-12', 'Stiff-Legged Dumbbell Deadlift'),
    ('Hip thrust com barra',          'gluteos',         'posterior',  90,  '4x10-12', 'Barbell Hip Thrust'),
    ('Passada com halteres',          'gluteos',         'quadriceps', 90,  '3x10-12', 'Dumbbell Lunges'),
    ('Cadeira Adutora',               'adutor',          null,         60,  '3x12-15', 'Thigh Adductor'),
    ('Cadeira Abdutora',              'gluteo medio',    null,         60,  '3x12-15', 'Thigh Abductor'),
    ('Panturrilha em pé',             'panturrilha',     null,         60,  '4x12-15', 'Standing Calf Raises'),
    ('Panturrilha sentado',           'panturrilha',     null,         60,  '4x12-15', 'Seated Calf Raise'),
    ('Hiperextensão no banco',        'lombar',          'gluteos',    60,  '3x12-15', 'Hyperextensions (Back Extensions)'),
    ('Superman',                      'lombar',          null,         45,  '3x12-15', 'Superman')
)
insert into public.exercises (name, primary_muscle, secondary_muscle, rest_seconds, scheme, exercise_library_id, owner_id)
select n.name, n.primary_muscle, n.secondary_muscle, n.rest_seconds, n.scheme,
       (select l.id from public.exercise_library l where lower(l.name) = lower(n.library_name) limit 1),
       null
from new_exercises n
where not exists (
  select 1 from public.exercises e
  where e.owner_id is null and lower(btrim(e.name)) = lower(btrim(n.name))
);

-- ── 3. Curated substitutes (by name; rank 1 = best) ─────────────────────────
with pairs (exercise_name, substitute_name, rank) as (
  values
    -- Peito
    ('Supino na Máquina', 'Supino reto com halteres', 1), ('Supino na Máquina', 'Supino Reto máquina deitado', 2),
    ('Supino na Máquina', 'Flexão de braço', 3), ('Supino na Máquina', 'Crossover na polia', 4),
    ('Supino Reto máquina deitado', 'Supino reto com halteres', 1), ('Supino Reto máquina deitado', 'Supino na Máquina', 2),
    ('Supino Reto máquina deitado', 'Flexão de braço', 3), ('Supino Reto máquina deitado', 'Crucifixo com halteres', 4),
    -- Costas
    ('Puxada Alta na Máquina', 'Puxada frente na polia', 1), ('Puxada Alta na Máquina', 'Graviton', 2),
    ('Puxada Alta na Máquina', 'Pull down barra reta (polia alta)', 3),
    ('Graviton', 'Puxada Alta na Máquina', 1), ('Graviton', 'Puxada frente na polia', 2),
    ('Graviton', 'Pull down barra reta (polia alta)', 3),
    ('Pull down barra reta (polia alta)', 'Puxada frente na polia', 1), ('Pull down barra reta (polia alta)', 'Puxada Alta na Máquina', 2),
    ('Pull down barra reta (polia alta)', 'Remada unilateral com halter', 3),
    ('Remada na Máquina', 'Remada baixa na polia', 1), ('Remada na Máquina', 'Remada unilateral com halter', 2),
    ('Remada na Máquina', 'Remada Curvada Pronada barra livre', 3),
    ('Remada Curvada Pronada barra livre', 'Remada unilateral com halter', 1), ('Remada Curvada Pronada barra livre', 'Remada baixa na polia', 2),
    ('Remada Curvada Pronada barra livre', 'Remada na Máquina', 3),
    ('Remada Curvada carga leve', 'Remada unilateral com halter', 1), ('Remada Curvada carga leve', 'Remada baixa na polia', 2),
    -- Ombros
    ('Desenvolvimento na Máquina', 'Desenvolvimento com halteres', 1), ('Desenvolvimento na Máquina', 'Desenvolvimento de ombros máquina sentado', 2),
    ('Desenvolvimento na Máquina', 'Desenvolvimento no Banco', 3),
    ('Desenvolvimento de ombros máquina sentado', 'Desenvolvimento com halteres', 1), ('Desenvolvimento de ombros máquina sentado', 'Desenvolvimento na Máquina', 2),
    ('Desenvolvimento de ombros máquina sentado', 'Desenvolvimento no Banco', 3),
    ('Desenvolvimento no Banco', 'Desenvolvimento com halteres', 1), ('Desenvolvimento no Banco', 'Desenvolvimento na Máquina', 2),
    ('Elevação lateral', 'Elevação lateral na polia', 1), ('Elevação lateral', 'Desenvolvimento com halteres', 2),
    ('Fly Inverso', 'Crucifixo Inverso com halter', 1), ('Fly Inverso', 'Face pull na polia', 2),
    ('Crucifixo Inverso com halter', 'Fly Inverso', 1), ('Crucifixo Inverso com halter', 'Face pull na polia', 2),
    -- Bíceps
    ('Bíceps na Máquina', 'Rosca alternada com halteres', 1), ('Bíceps na Máquina', 'Rosca direta com barra', 2),
    ('Bíceps na Máquina', 'Rosca Bíceps na Polia', 3), ('Bíceps na Máquina', 'Bíceps Rosca martelo com halter', 4),
    ('Rosca Bíceps na Polia', 'Rosca alternada com halteres', 1), ('Rosca Bíceps na Polia', 'Rosca direta com barra', 2),
    ('Rosca Bíceps na Polia', 'Bíceps na Máquina', 3),
    ('Bíceps Rosca direta polia baixa', 'Rosca direta com barra', 1), ('Bíceps Rosca direta polia baixa', 'Rosca alternada com halteres', 2),
    ('Bíceps Rosca direta polia baixa', 'Bíceps na Máquina', 3), ('Bíceps Rosca direta polia baixa', 'Bíceps Rosca martelo com halter', 4),
    ('Bíceps Rosca martelo com halter', 'Rosca alternada com halteres', 1), ('Bíceps Rosca martelo com halter', 'Bíceps Rosca direta polia baixa', 2),
    ('Bíceps Rosca martelo com halter', 'Rosca direta com barra', 3),
    -- Tríceps
    ('Tríceps na Polia', 'Tríceps francês com halter', 1), ('Tríceps na Polia', 'Triceps Testa', 2),
    ('Tríceps na Polia', 'Mergulho no banco', 3), ('Tríceps na Polia', 'Tríceps na Máquina', 4),
    ('Tríceps na Máquina', 'Tríceps na Polia', 1), ('Tríceps na Máquina', 'Tríceps francês com halter', 2),
    ('Tríceps na Máquina', 'Mergulho no banco', 3),
    ('Triceps Testa', 'Tríceps francês com halter', 1), ('Triceps Testa', 'Tríceps na Polia', 2), ('Triceps Testa', 'Mergulho no banco', 3),
    -- Braços (combinados)
    ('Bíceps + Tríceps Máquina', 'Bíceps + Tríceps Combinado', 1), ('Bíceps + Tríceps Máquina', 'Rosca alternada com halteres', 2),
    ('Bíceps + Tríceps Máquina', 'Tríceps na Polia', 3),
    ('Bíceps + Tríceps Combinado', 'Bíceps + Tríceps Máquina', 1), ('Bíceps + Tríceps Combinado', 'Rosca alternada com halteres', 2),
    ('Bíceps + Tríceps Combinado', 'Tríceps na Polia', 3),
    -- Quadríceps
    ('Leg Press 45°', 'Agachamento hack', 1), ('Leg Press 45°', 'Agachamento na Máquina', 2),
    ('Leg Press 45°', 'Agachamento barra guiada Smith', 3), ('Leg Press 45°', 'Agachamento goblet', 4),
    ('Agachamento na Máquina', 'Leg Press 45°', 1), ('Agachamento na Máquina', 'Agachamento hack', 2),
    ('Agachamento na Máquina', 'Agachamento barra guiada Smith', 3), ('Agachamento na Máquina', 'Agachamento goblet', 4),
    ('Agachamento Livre (barra)', 'Agachamento barra guiada Smith', 1), ('Agachamento Livre (barra)', 'Agachamento goblet', 2),
    ('Agachamento Livre (barra)', 'Leg Press 45°', 3), ('Agachamento Livre (barra)', 'Agachamento hack', 4),
    ('Agachamento barra guiada Smith', 'Agachamento Livre (barra)', 1), ('Agachamento barra guiada Smith', 'Agachamento goblet', 2),
    ('Agachamento barra guiada Smith', 'Leg Press 45°', 3), ('Agachamento barra guiada Smith', 'Agachamento na Máquina', 4),
    ('Cadeira Extensora', 'Leg Press 45°', 1), ('Cadeira Extensora', 'Agachamento goblet', 2), ('Cadeira Extensora', 'Afundo', 3),
    -- Adutores / glúteo médio
    ('Agachamento Sumô', 'Leg Press 45° Perna Aberta', 1), ('Agachamento Sumô', 'Cadeira Adutora', 2), ('Agachamento Sumô', 'Agachamento goblet', 3),
    ('Leg Press 45° Perna Aberta', 'Agachamento Sumô', 1), ('Leg Press 45° Perna Aberta', 'Cadeira Adutora', 2),
    ('Leg Press 45° Perna Aberta', 'Agachamento goblet', 3),
    ('Abdutora 45°', 'Cadeira Abdutora', 1), ('Abdutora 45°', 'Glúteo na polia (perna esticada)', 2),
    -- Posterior
    ('Cadeira Flexora', 'Mesa Flexora', 1), ('Cadeira Flexora', 'Stiff com halteres', 2), ('Cadeira Flexora', 'Stiff', 3),
    ('Mesa Flexora', 'Cadeira Flexora', 1), ('Mesa Flexora', 'Stiff com halteres', 2), ('Mesa Flexora', 'Stiff barra livre', 3),
    ('Stiff', 'Stiff com halteres', 1), ('Stiff', 'Stiff barra livre', 2), ('Stiff', 'Mesa Flexora', 3),
    ('Stiff barra livre', 'Stiff com halteres', 1), ('Stiff barra livre', 'Stiff', 2), ('Stiff barra livre', 'Mesa Flexora', 3),
    -- Glúteos
    ('Elevação Pélvica máquina', 'Hip thrust com barra', 1), ('Elevação Pélvica máquina', 'Elevação Pélvica chão', 2),
    ('Elevação Pélvica máquina', 'Glúteo na polia (perna esticada)', 3),
    ('Elevação Pélvica chão', 'Elevação Pélvica máquina', 1), ('Elevação Pélvica chão', 'Hip thrust com barra', 2),
    ('Elevação Pélvica chão', 'Glúteo na polia (perna esticada)', 3),
    ('Glúteo na polia (perna esticada)', 'Elevação Pélvica máquina', 1), ('Glúteo na polia (perna esticada)', 'Hip thrust com barra', 2),
    ('Glúteo na polia (perna esticada)', 'Elevação Pélvica chão', 3),
    ('Búlgaro', 'Afundo com halteres (step)', 1), ('Búlgaro', 'Passada com halteres', 2), ('Búlgaro', 'Afundo', 3),
    ('Afundo', 'Afundo com halteres (step)', 1), ('Afundo', 'Búlgaro', 2), ('Afundo', 'Passada com halteres', 3),
    ('Afundo com halteres (step)', 'Búlgaro', 1), ('Afundo com halteres (step)', 'Passada com halteres', 2), ('Afundo com halteres (step)', 'Afundo', 3),
    ('Side to side Squat alternado', 'Agachamento goblet', 1), ('Side to side Squat alternado', 'Afundo', 2),
    -- Panturrilha / lombar / core / cardio
    ('Panturrilha no Leg Press', 'Panturrilha em pé', 1), ('Panturrilha no Leg Press', 'Panturrilha sentado', 2),
    ('Lombar', 'Hiperextensão no banco', 1), ('Lombar', 'Superman', 2),
    ('Abdominal Crunch', 'Elevação de Pernas', 1), ('Abdominal Crunch', 'Prancha', 2),
    ('Elevação de Pernas', 'Abdominal Crunch', 1), ('Elevação de Pernas', 'Prancha', 2),
    ('Prancha', 'Abdominal Crunch', 1), ('Prancha', 'Elevação de Pernas', 2),
    ('Corrida', 'Skipping', 1), ('Corrida', 'Butt Kick', 2),
    ('Skipping', 'Butt Kick', 1), ('Skipping', 'Corrida', 2),
    ('Butt Kick', 'Skipping', 1), ('Butt Kick', 'Corrida', 2)
)
insert into public.exercise_substitutes (exercise_id, substitute_id, rank)
select e.id, s.id, p.rank
from pairs p
join public.exercises e on e.owner_id is null and lower(btrim(e.name)) = lower(btrim(p.exercise_name))
join public.exercises s on s.owner_id is null and lower(btrim(s.name)) = lower(btrim(p.substitute_name))
on conflict (exercise_id, substitute_id) do update set rank = excluded.rank;

commit;

-- Check (read-only): exercises of the catalogue still without substitutes
-- select e.name from public.exercises e
-- where e.owner_id is null
--   and not exists (select 1 from public.exercise_substitutes x where x.exercise_id = e.id)
-- order by e.name;
