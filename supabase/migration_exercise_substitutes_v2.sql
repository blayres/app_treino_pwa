-- Migration: exercise substitutes, second curation ("Ver substitutos")
-- Apply in the Supabase SQL Editor AFTER migration_exercise_substitutes.sql.
-- Idempotent: safe to run again (replaces the curated lists of the catalogue).
--
-- The first curation listed the same movement several times under other names:
-- "Afundo" showed "Afundo com halteres (step)", "Passada com halteres" and
-- "Búlgaro" — three lunges, two of them with the same animation. Rules now:
--   - a substitute is a DIFFERENT exercise: other equipment for the same
--     movement (machine → dumbbells/barbell/cable/bodyweight) or another
--     movement for the same muscle; never the same exercise renamed
--     (Stiff ↔ Stiff barra livre, Lombar ↔ Hiperextensão, Leg Press ↔ Leg Press
--     perna aberta, the two shoulder press machines…);
--   - at most one variation of a movement per list (one lunge, one stiff…);
--   - never two substitutes with the same animation (the app also guards this,
--     see distinctSubstitutes in substituteService.ts);
--   - every catalogue exercise with a muscle gets 2–4 options, rank 1 = best.
-- Exercises without curated rows (e.g. the user's own) get substitutes by
-- muscle in the app.
--
-- Undo: run migration_exercise_substitutes.sql again (it re-inserts the old pairs;
-- delete the rows first to drop the new ones).

begin;

-- Pairs for this run (temp table: used by the delete and the insert below).
create temp table substitute_pairs_v2 on commit drop as
with pairs (exercise_name, substitute_name, rank) as (
  values
    -- Peito
    ('Supino na Máquina', 'Supino reto com halteres', 1), ('Supino na Máquina', 'Flexão de braço', 2),
    ('Supino na Máquina', 'Crossover na polia', 3), ('Supino na Máquina', 'Crucifixo com halteres', 4),
    ('Supino Reto máquina deitado', 'Supino reto com halteres', 1), ('Supino Reto máquina deitado', 'Flexão de braço', 2),
    ('Supino Reto máquina deitado', 'Crossover na polia', 3), ('Supino Reto máquina deitado', 'Crucifixo com halteres', 4),
    ('Supino reto com halteres', 'Supino na Máquina', 1), ('Supino reto com halteres', 'Flexão de braço', 2),
    ('Supino reto com halteres', 'Crossover na polia', 3),
    ('Flexão de braço', 'Supino reto com halteres', 1), ('Flexão de braço', 'Supino na Máquina', 2),
    ('Flexão de braço', 'Crossover na polia', 3),
    ('Crucifixo com halteres', 'Crossover na polia', 1), ('Crucifixo com halteres', 'Supino reto com halteres', 2),
    ('Crucifixo com halteres', 'Flexão de braço', 3),
    ('Crossover na polia', 'Crucifixo com halteres', 1), ('Crossover na polia', 'Supino reto com halteres', 2),
    ('Crossover na polia', 'Flexão de braço', 3),
    -- Costas: puxadas
    ('Puxada Alta na Máquina', 'Puxada frente na polia', 1), ('Puxada Alta na Máquina', 'Graviton', 2),
    ('Puxada Alta na Máquina', 'Pull down barra reta (polia alta)', 3),
    ('Graviton', 'Puxada Alta na Máquina', 1), ('Graviton', 'Puxada frente na polia', 2),
    ('Graviton', 'Pull down barra reta (polia alta)', 3),
    ('Puxada frente na polia', 'Puxada Alta na Máquina', 1), ('Puxada frente na polia', 'Graviton', 2),
    ('Puxada frente na polia', 'Remada unilateral com halter', 3),
    ('Pull down barra reta (polia alta)', 'Puxada frente na polia', 1), ('Pull down barra reta (polia alta)', 'Puxada Alta na Máquina', 2),
    ('Pull down barra reta (polia alta)', 'Remada unilateral com halter', 3),
    -- Costas: remadas
    ('Remada na Máquina', 'Remada unilateral com halter', 1), ('Remada na Máquina', 'Remada Curvada Pronada barra livre', 2),
    ('Remada na Máquina', 'Puxada frente na polia', 3),
    ('Remada baixa na polia', 'Remada unilateral com halter', 1), ('Remada baixa na polia', 'Remada Curvada Pronada barra livre', 2),
    ('Remada baixa na polia', 'Puxada frente na polia', 3),
    ('Remada Curvada Pronada barra livre', 'Remada unilateral com halter', 1), ('Remada Curvada Pronada barra livre', 'Remada baixa na polia', 2),
    ('Remada Curvada Pronada barra livre', 'Puxada frente na polia', 3),
    ('Remada Curvada carga leve', 'Remada unilateral com halter', 1), ('Remada Curvada carga leve', 'Remada baixa na polia', 2),
    ('Remada Curvada carga leve', 'Puxada frente na polia', 3),
    ('Remada unilateral com halter', 'Remada baixa na polia', 1), ('Remada unilateral com halter', 'Remada Curvada Pronada barra livre', 2),
    ('Remada unilateral com halter', 'Puxada frente na polia', 3),
    -- Ombros
    ('Desenvolvimento na Máquina', 'Desenvolvimento com halteres', 1), ('Desenvolvimento na Máquina', 'Elevação lateral', 2),
    ('Desenvolvimento na Máquina', 'Elevação lateral na polia', 3),
    ('Desenvolvimento de ombros máquina sentado', 'Desenvolvimento com halteres', 1), ('Desenvolvimento de ombros máquina sentado', 'Elevação lateral', 2),
    ('Desenvolvimento de ombros máquina sentado', 'Elevação lateral na polia', 3),
    ('Desenvolvimento no Banco', 'Desenvolvimento na Máquina', 1), ('Desenvolvimento no Banco', 'Elevação lateral', 2),
    ('Desenvolvimento no Banco', 'Elevação lateral na polia', 3),
    ('Desenvolvimento com halteres', 'Desenvolvimento na Máquina', 1), ('Desenvolvimento com halteres', 'Elevação lateral', 2),
    ('Desenvolvimento com halteres', 'Elevação lateral na polia', 3),
    ('Elevação lateral', 'Elevação lateral na polia', 1), ('Elevação lateral', 'Desenvolvimento com halteres', 2),
    ('Elevação lateral', 'Desenvolvimento na Máquina', 3),
    ('Elevação lateral na polia', 'Elevação lateral', 1), ('Elevação lateral na polia', 'Desenvolvimento com halteres', 2),
    ('Elevação lateral na polia', 'Desenvolvimento na Máquina', 3),
    -- Ombro posterior (Fly Inverso = máquina, Crucifixo Inverso = halter)
    ('Fly Inverso', 'Crucifixo Inverso com halter', 1), ('Fly Inverso', 'Face pull na polia', 2),
    ('Crucifixo Inverso com halter', 'Fly Inverso', 1), ('Crucifixo Inverso com halter', 'Face pull na polia', 2),
    ('Face pull na polia', 'Crucifixo Inverso com halter', 1), ('Face pull na polia', 'Remada unilateral com halter', 2),
    -- Bíceps (as duas roscas na polia são o mesmo exercício: só uma por lista)
    ('Bíceps na Máquina', 'Rosca alternada com halteres', 1), ('Bíceps na Máquina', 'Rosca direta com barra', 2),
    ('Bíceps na Máquina', 'Rosca Bíceps na Polia', 3), ('Bíceps na Máquina', 'Bíceps Rosca martelo com halter', 4),
    ('Rosca Bíceps na Polia', 'Rosca alternada com halteres', 1), ('Rosca Bíceps na Polia', 'Rosca direta com barra', 2),
    ('Rosca Bíceps na Polia', 'Bíceps na Máquina', 3), ('Rosca Bíceps na Polia', 'Bíceps Rosca martelo com halter', 4),
    ('Bíceps Rosca direta polia baixa', 'Rosca direta com barra', 1), ('Bíceps Rosca direta polia baixa', 'Rosca alternada com halteres', 2),
    ('Bíceps Rosca direta polia baixa', 'Bíceps na Máquina', 3), ('Bíceps Rosca direta polia baixa', 'Bíceps Rosca martelo com halter', 4),
    ('Bíceps Rosca martelo com halter', 'Rosca alternada com halteres', 1), ('Bíceps Rosca martelo com halter', 'Rosca direta com barra', 2),
    ('Bíceps Rosca martelo com halter', 'Rosca Bíceps na Polia', 3), ('Bíceps Rosca martelo com halter', 'Bíceps na Máquina', 4),
    ('Rosca alternada com halteres', 'Rosca direta com barra', 1), ('Rosca alternada com halteres', 'Bíceps Rosca martelo com halter', 2),
    ('Rosca alternada com halteres', 'Rosca Bíceps na Polia', 3), ('Rosca alternada com halteres', 'Bíceps na Máquina', 4),
    ('Rosca direta com barra', 'Rosca alternada com halteres', 1), ('Rosca direta com barra', 'Rosca Bíceps na Polia', 2),
    ('Rosca direta com barra', 'Bíceps na Máquina', 3), ('Rosca direta com barra', 'Bíceps Rosca martelo com halter', 4),
    -- Tríceps
    ('Tríceps na Polia', 'Tríceps francês com halter', 1), ('Tríceps na Polia', 'Triceps Testa', 2),
    ('Tríceps na Polia', 'Mergulho no banco', 3), ('Tríceps na Polia', 'Tríceps na Máquina', 4),
    ('Tríceps na Máquina', 'Tríceps na Polia', 1), ('Tríceps na Máquina', 'Tríceps francês com halter', 2),
    ('Tríceps na Máquina', 'Triceps Testa', 3), ('Tríceps na Máquina', 'Mergulho no banco', 4),
    ('Triceps Testa', 'Tríceps francês com halter', 1), ('Triceps Testa', 'Tríceps na Polia', 2),
    ('Triceps Testa', 'Mergulho no banco', 3), ('Triceps Testa', 'Tríceps na Máquina', 4),
    ('Tríceps francês com halter', 'Triceps Testa', 1), ('Tríceps francês com halter', 'Tríceps na Polia', 2),
    ('Tríceps francês com halter', 'Mergulho no banco', 3), ('Tríceps francês com halter', 'Tríceps na Máquina', 4),
    ('Mergulho no banco', 'Tríceps na Polia', 1), ('Mergulho no banco', 'Tríceps francês com halter', 2),
    ('Mergulho no banco', 'Tríceps na Máquina', 3), ('Mergulho no banco', 'Triceps Testa', 4),
    -- Braços (combinados)
    ('Bíceps + Tríceps Máquina', 'Bíceps + Tríceps Combinado', 1), ('Bíceps + Tríceps Máquina', 'Rosca alternada com halteres', 2),
    ('Bíceps + Tríceps Máquina', 'Tríceps na Polia', 3),
    ('Bíceps + Tríceps Combinado', 'Bíceps + Tríceps Máquina', 1), ('Bíceps + Tríceps Combinado', 'Rosca alternada com halteres', 2),
    ('Bíceps + Tríceps Combinado', 'Tríceps na Polia', 3),
    -- Quadríceps
    ('Leg Press 45°', 'Agachamento hack', 1), ('Leg Press 45°', 'Agachamento na Máquina', 2),
    ('Leg Press 45°', 'Agachamento goblet', 3), ('Leg Press 45°', 'Búlgaro', 4),
    ('Agachamento na Máquina', 'Leg Press 45°', 1), ('Agachamento na Máquina', 'Agachamento hack', 2),
    ('Agachamento na Máquina', 'Agachamento Livre (barra)', 3), ('Agachamento na Máquina', 'Agachamento goblet', 4),
    ('Agachamento barra guiada Smith', 'Agachamento Livre (barra)', 1), ('Agachamento barra guiada Smith', 'Leg Press 45°', 2),
    ('Agachamento barra guiada Smith', 'Agachamento hack', 3), ('Agachamento barra guiada Smith', 'Agachamento goblet', 4),
    ('Agachamento Livre (barra)', 'Agachamento barra guiada Smith', 1), ('Agachamento Livre (barra)', 'Leg Press 45°', 2),
    ('Agachamento Livre (barra)', 'Agachamento hack', 3), ('Agachamento Livre (barra)', 'Agachamento goblet', 4),
    ('Agachamento hack', 'Leg Press 45°', 1), ('Agachamento hack', 'Agachamento na Máquina', 2),
    ('Agachamento hack', 'Agachamento Livre (barra)', 3), ('Agachamento hack', 'Agachamento goblet', 4),
    ('Agachamento goblet', 'Agachamento Livre (barra)', 1), ('Agachamento goblet', 'Leg Press 45°', 2),
    ('Agachamento goblet', 'Búlgaro', 3), ('Agachamento goblet', 'Agachamento na Máquina', 4),
    ('Cadeira Extensora', 'Leg Press 45°', 1), ('Cadeira Extensora', 'Agachamento hack', 2),
    ('Cadeira Extensora', 'Agachamento goblet', 3), ('Cadeira Extensora', 'Afundo', 4),
    -- Afundos (Afundo, Afundo com halteres (step), Passada, Búlgaro): um só por lista
    ('Afundo', 'Búlgaro', 1), ('Afundo', 'Agachamento goblet', 2),
    ('Afundo', 'Leg Press 45°', 3), ('Afundo', 'Agachamento barra guiada Smith', 4),
    ('Afundo com halteres (step)', 'Búlgaro', 1), ('Afundo com halteres (step)', 'Agachamento goblet', 2),
    ('Afundo com halteres (step)', 'Leg Press 45°', 3), ('Afundo com halteres (step)', 'Agachamento barra guiada Smith', 4),
    ('Passada com halteres', 'Búlgaro', 1), ('Passada com halteres', 'Agachamento goblet', 2),
    ('Passada com halteres', 'Leg Press 45°', 3), ('Passada com halteres', 'Hip thrust com barra', 4),
    ('Búlgaro', 'Afundo', 1), ('Búlgaro', 'Agachamento goblet', 2),
    ('Búlgaro', 'Leg Press 45°', 3), ('Búlgaro', 'Hip thrust com barra', 4),
    ('Side to side Squat alternado', 'Agachamento goblet', 1), ('Side to side Squat alternado', 'Afundo', 2),
    ('Side to side Squat alternado', 'Agachamento Sumô', 3),
    -- Adutores / glúteo médio
    ('Agachamento Sumô', 'Cadeira Adutora', 1), ('Agachamento Sumô', 'Leg Press 45° Perna Aberta', 2),
    ('Agachamento Sumô', 'Agachamento goblet', 3),
    ('Leg Press 45° Perna Aberta', 'Agachamento Sumô', 1), ('Leg Press 45° Perna Aberta', 'Cadeira Adutora', 2),
    ('Leg Press 45° Perna Aberta', 'Agachamento goblet', 3),
    ('Cadeira Adutora', 'Agachamento Sumô', 1), ('Cadeira Adutora', 'Leg Press 45° Perna Aberta', 2),
    ('Abdutora 45°', 'Cadeira Abdutora', 1), ('Abdutora 45°', 'Glúteo na polia (perna esticada)', 2),
    ('Cadeira Abdutora', 'Abdutora 45°', 1), ('Cadeira Abdutora', 'Glúteo na polia (perna esticada)', 2),
    -- Posterior (Stiff e Stiff barra livre são o mesmo: só um por lista)
    ('Cadeira Flexora', 'Mesa Flexora', 1), ('Cadeira Flexora', 'Stiff com halteres', 2), ('Cadeira Flexora', 'Stiff barra livre', 3),
    ('Mesa Flexora', 'Cadeira Flexora', 1), ('Mesa Flexora', 'Stiff com halteres', 2), ('Mesa Flexora', 'Stiff barra livre', 3),
    ('Stiff', 'Stiff com halteres', 1), ('Stiff', 'Mesa Flexora', 2), ('Stiff', 'Cadeira Flexora', 3),
    ('Stiff barra livre', 'Stiff com halteres', 1), ('Stiff barra livre', 'Mesa Flexora', 2), ('Stiff barra livre', 'Cadeira Flexora', 3),
    ('Stiff com halteres', 'Stiff barra livre', 1), ('Stiff com halteres', 'Mesa Flexora', 2), ('Stiff com halteres', 'Cadeira Flexora', 3),
    -- Glúteos (Elevação Pélvica máquina e Hip thrust com barra: só um por lista)
    ('Elevação Pélvica máquina', 'Hip thrust com barra', 1), ('Elevação Pélvica máquina', 'Elevação Pélvica chão', 2),
    ('Elevação Pélvica máquina', 'Glúteo na polia (perna esticada)', 3), ('Elevação Pélvica máquina', 'Búlgaro', 4),
    ('Hip thrust com barra', 'Elevação Pélvica máquina', 1), ('Hip thrust com barra', 'Elevação Pélvica chão', 2),
    ('Hip thrust com barra', 'Glúteo na polia (perna esticada)', 3), ('Hip thrust com barra', 'Búlgaro', 4),
    ('Elevação Pélvica chão', 'Hip thrust com barra', 1), ('Elevação Pélvica chão', 'Glúteo na polia (perna esticada)', 2),
    ('Elevação Pélvica chão', 'Búlgaro', 3),
    ('Glúteo na polia (perna esticada)', 'Hip thrust com barra', 1), ('Glúteo na polia (perna esticada)', 'Elevação Pélvica chão', 2),
    ('Glúteo na polia (perna esticada)', 'Búlgaro', 3),
    -- Lombar (Lombar e Hiperextensão no banco são o mesmo exercício)
    ('Lombar', 'Superman', 1), ('Lombar', 'Stiff com halteres', 2),
    ('Hiperextensão no banco', 'Superman', 1), ('Hiperextensão no banco', 'Stiff com halteres', 2),
    ('Superman', 'Hiperextensão no banco', 1), ('Superman', 'Prancha', 2),
    -- Panturrilha
    ('Panturrilha no Leg Press', 'Panturrilha em pé', 1), ('Panturrilha no Leg Press', 'Panturrilha sentado', 2),
    ('Panturrilha em pé', 'Panturrilha sentado', 1), ('Panturrilha em pé', 'Panturrilha no Leg Press', 2),
    ('Panturrilha sentado', 'Panturrilha em pé', 1), ('Panturrilha sentado', 'Panturrilha no Leg Press', 2),
    -- Core / cardio
    ('Abdominal Crunch', 'Elevação de Pernas', 1), ('Abdominal Crunch', 'Prancha', 2),
    ('Elevação de Pernas', 'Abdominal Crunch', 1), ('Elevação de Pernas', 'Prancha', 2),
    ('Prancha', 'Abdominal Crunch', 1), ('Prancha', 'Elevação de Pernas', 2),
    ('Corrida', 'Skipping', 1), ('Corrida', 'Butt Kick', 2),
    ('Skipping', 'Butt Kick', 1), ('Skipping', 'Corrida', 2),
    ('Butt Kick', 'Skipping', 1), ('Butt Kick', 'Corrida', 2)
)
select e.id as exercise_id, s.id as substitute_id, p.rank
from pairs p
join public.exercises e on e.owner_id is null and lower(btrim(e.name)) = lower(btrim(p.exercise_name))
join public.exercises s on s.owner_id is null and lower(btrim(s.name)) = lower(btrim(p.substitute_name));

-- Replace the whole curated list of every catalogue exercise listed above.
delete from public.exercise_substitutes x
where x.exercise_id in (select exercise_id from substitute_pairs_v2);

insert into public.exercise_substitutes (exercise_id, substitute_id, rank)
select exercise_id, substitute_id, rank from substitute_pairs_v2
on conflict (exercise_id, substitute_id) do update set rank = excluded.rank;

commit;

-- Check (read-only): lists that still show the same animation twice (expect none)
-- select e.name, l.gif_url, count(*)
-- from public.exercise_substitutes x
-- join public.exercises e on e.id = x.exercise_id
-- join public.exercises s on s.id = x.substitute_id
-- join public.exercise_library l on l.id = s.exercise_library_id
-- group by e.name, l.gif_url having count(*) > 1;
