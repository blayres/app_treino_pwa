-- Migration: translated exercise names (en / es / fr); catalogue tips removed
-- Apply in the Supabase SQL Editor. Idempotent: safe to run again.
--
-- The catalogue stays in Portuguese in exercises.name (the reference text, also
-- used to match exercises by name). The translations go in name_i18n:
-- {"en": "...", "es": "...", "fr": "..."}. The app shows the user's language and
-- falls back to Portuguese when a translation is missing.
-- Exercises created by users (owner_id not null) keep only what they typed.
--
-- Catalogue tips are cleared (tip and tip_i18n = null): generic form cues don't
-- always match what each coach teaches. The coach's per-workout notes are the
-- only text shown under an exercise. tip_i18n stays for exercises that may get
-- a tip again later.
--
-- Undo: alter table public.exercises drop column if exists name_i18n, drop column if exists tip_i18n;
-- Previous Portuguese tips (27 exercises, the others had none), to restore by hand if needed:
--   Cadeira Extensora: Amplitude parcial (0–60°). Carga moderada. Fortalece sem estressar o joelho.
--   Agachamento Sumô: Pontas dos pés abertas 45°. Descida lenta (3s), subida explosiva. Ótimo para posterior e adutor.
--   Abdutora 45°: Contração no topo por 1s. Glúteo médio contribui para o formato redondo do posterior.
--   Remada na Máquina: Retrai escápulas antes de puxar. Não arredondar a lombar. Base essencial para chegar na barra.
--   Graviton: Escápulas retraídas, cotovelos apontam para baixo. Reduza 2,5kg no contrapeso a cada 2 semanas que completar todas as séries.
--   Fly Inverso: Carga leve, amplitude total. Corrige postura e alivia tensão cervical.
--   Desenvolvimento no Banco: Banco 80°. Fortalece ombro e melhora postura.
--   Lombar: Sem hiperestender no final. Fortalece cadeia posterior e previne dor lombar.
--   Prancha: Quadril neutro. Respire normalmente. Adicione 5s por semana.
--   Abdominal Crunch: Contração no topo por 1s. Sem puxar o pescoço.
--   Elevação de Pernas: Lombar colada no banco. Descida controlada. Foco no core inferior.
--   Panturrilha no Leg Press: Amplitude total. Pausa 1s no topo. Panturrilha forte = corrida mais eficiente.
--   Stiff: Joelhos semi-flexos. Empurre o quadril para trás, não curve a coluna. Amplitude máxima controlada.
--   Cadeira Flexora: Leg curl favorito dela. Controle a descida em 3s. Volume alto para desenvolver o ponto fraco.
--   Supino na Máquina: Controle seguro. Não arquear lombar.
--   Leg Press 45°: Pés na largura do quadril. Desça até 90°, empurre pelos calcanhares.
--   Agachamento Livre (barra): Barra no trapézio, pés na largura do quadril. Desça até 90°. Sem peso excessivo — técnica primeiro.
--   Bíceps + Tríceps Combinado: Alterne bíceps e tríceps na polia sem descanso entre os dois. Descanse 60s após o par.
--   Remada Curvada carga leve: Aquecimento
--   Mackenzie dinâmico: Mobilidade
--   Mobilidade ombros dinâmico de joelhos e braços esticados: Mobilidade
--   Skipping: Cardio
--   Remada Curvada Pronada barra livre: 9-11 + drop
--   Supino Reto máquina deitado: progressivo
--   Elevação lateral: drop + cardio
--   Bíceps na Máquina: Controle total na descida. Rep range alto para definição sem volume excessivo.
--   Tríceps na Máquina: Cotovelos fixos. Extensão completa sem travar a articulação.

begin;

alter table public.exercises add column if not exists name_i18n jsonb;
alter table public.exercises add column if not exists tip_i18n jsonb;

comment on column public.exercises.name_i18n is 'Name in other languages: {"en","es","fr"}; Portuguese is exercises.name.';
comment on column public.exercises.tip_i18n is 'Tip in other languages: {"en","es","fr"}; Portuguese is exercises.tip.';

-- Global catalogue only, matched by its Portuguese name.
with translations (name, name_i18n) as (
  values
    ('Leg Press 45° Perna Aberta', '{"en": "45° Leg Press (Wide Stance)", "es": "Prensa de piernas 45° (piernas abiertas)", "fr": "Presse à cuisses 45° (pieds écartés)"}'::jsonb),
    ('Cadeira Extensora', '{"en": "Leg Extension", "es": "Extensión de cuádriceps en máquina", "fr": "Leg extension (machine)"}'::jsonb),
    ('Agachamento Sumô', '{"en": "Sumo Squat", "es": "Sentadilla sumo", "fr": "Squat sumo"}'::jsonb),
    ('Afundo', '{"en": "Lunge", "es": "Zancada", "fr": "Fente"}'::jsonb),
    ('Abdutora 45°', '{"en": "45° Hip Abduction", "es": "Abducción de cadera 45°", "fr": "Abduction de hanche 45°"}'::jsonb),
    ('Remada na Máquina', '{"en": "Machine Row", "es": "Remo en máquina", "fr": "Rowing à la machine"}'::jsonb),
    ('Graviton', '{"en": "Assisted Pull-Up (Graviton)", "es": "Dominadas asistidas (Graviton)", "fr": "Tractions assistées (Graviton)"}'::jsonb),
    ('Fly Inverso', '{"en": "Reverse Fly", "es": "Aperturas invertidas", "fr": "Écarté inversé"}'::jsonb),
    ('Desenvolvimento no Banco', '{"en": "Bench Shoulder Press", "es": "Press de hombros en banco", "fr": "Développé épaules sur banc"}'::jsonb),
    ('Bíceps + Tríceps Máquina', '{"en": "Biceps + Triceps (Machine)", "es": "Bíceps + tríceps en máquina", "fr": "Biceps + triceps à la machine"}'::jsonb),
    ('Lombar', '{"en": "Lower Back Extension", "es": "Extensión lumbar", "fr": "Extension lombaire"}'::jsonb),
    ('Prancha', '{"en": "Plank", "es": "Plancha", "fr": "Gainage (planche)"}'::jsonb),
    ('Abdominal Crunch', '{"en": "Crunch", "es": "Crunch abdominal", "fr": "Crunch abdominal"}'::jsonb),
    ('Elevação de Pernas', '{"en": "Leg Raise", "es": "Elevación de piernas", "fr": "Relevé de jambes"}'::jsonb),
    ('Panturrilha no Leg Press', '{"en": "Calf Press on Leg Press", "es": "Gemelos en prensa", "fr": "Mollets à la presse"}'::jsonb),
    ('Stiff', '{"en": "Stiff-Leg Deadlift", "es": "Peso muerto con piernas rígidas", "fr": "Soulevé de terre jambes tendues"}'::jsonb),
    ('Búlgaro', '{"en": "Bulgarian Split Squat", "es": "Sentadilla búlgara", "fr": "Squat bulgare"}'::jsonb),
    ('Cadeira Flexora', '{"en": "Seated Leg Curl", "es": "Curl femoral sentado", "fr": "Leg curl assis"}'::jsonb),
    ('Supino na Máquina', '{"en": "Seated Machine Chest Press", "es": "Press de pecho en máquina", "fr": "Développé pectoral assis (machine)"}'::jsonb),
    ('Leg Press 45°', '{"en": "45° Leg Press", "es": "Prensa de piernas 45°", "fr": "Presse à cuisses 45°"}'::jsonb),
    ('Puxada Alta na Máquina', '{"en": "Machine Lat Pulldown", "es": "Jalón al pecho en máquina", "fr": "Tirage vertical à la machine"}'::jsonb),
    ('Rosca Bíceps na Polia', '{"en": "Cable Biceps Curl", "es": "Curl de bíceps en polea", "fr": "Curl biceps à la poulie"}'::jsonb),
    ('Agachamento na Máquina', '{"en": "Machine Squat", "es": "Sentadilla en máquina", "fr": "Squat à la machine"}'::jsonb),
    ('Desenvolvimento na Máquina', '{"en": "Machine Shoulder Press", "es": "Press de hombros en máquina", "fr": "Développé épaules à la machine"}'::jsonb),
    ('Tríceps na Polia', '{"en": "Cable Triceps Pushdown", "es": "Extensión de tríceps en polea", "fr": "Extension triceps à la poulie"}'::jsonb),
    ('Agachamento Livre (barra)', '{"en": "Barbell Back Squat", "es": "Sentadilla libre con barra", "fr": "Squat libre à la barre"}'::jsonb),
    ('Bíceps + Tríceps Combinado', '{"en": "Biceps + Triceps Superset", "es": "Bíceps + tríceps combinado", "fr": "Biceps + triceps en superset"}'::jsonb),
    ('Remada Curvada carga leve', '{"en": "Bent-Over Row (Light)", "es": "Remo inclinado (carga ligera)", "fr": "Rowing buste penché (charge légère)"}'::jsonb),
    ('Mackenzie dinâmico', '{"en": "Dynamic McKenzie", "es": "McKenzie dinámico", "fr": "McKenzie dynamique"}'::jsonb),
    ('Mobilidade ombros dinâmico de joelhos e braços esticados', '{"en": "Dynamic Shoulder Mobility (Kneeling, Arms Straight)", "es": "Movilidad dinámica de hombros (de rodillas, brazos estirados)", "fr": "Mobilité dynamique des épaules (à genoux, bras tendus)"}'::jsonb),
    ('Skipping', '{"en": "High Knees", "es": "Skipping", "fr": "Montées de genoux"}'::jsonb),
    ('Remada Curvada Pronada barra livre', '{"en": "Overhand Barbell Bent-Over Row", "es": "Remo inclinado con barra (agarre prono)", "fr": "Rowing barre buste penché (prise pronation)"}'::jsonb),
    ('Supino Reto máquina deitado', '{"en": "Lying Machine Chest Press", "es": "Press de banca en máquina (tumbado)", "fr": "Développé couché (machine)"}'::jsonb),
    ('Elevação lateral', '{"en": "Lateral Raise", "es": "Elevaciones laterales", "fr": "Élévations latérales"}'::jsonb),
    ('Cardio superior', '{"en": "Upper-Body Cardio", "es": "Cardio de tren superior", "fr": "Cardio haut du corps"}'::jsonb),
    ('Desenvolvimento de ombros máquina sentado', '{"en": "Seated Machine Shoulder Press", "es": "Press de hombros en máquina sentado", "fr": "Développé épaules assis (machine)"}'::jsonb),
    ('Crucifixo Inverso com halter', '{"en": "Dumbbell Reverse Fly", "es": "Aperturas invertidas con mancuerna", "fr": "Oiseau avec haltères"}'::jsonb),
    ('Bíceps Rosca direta polia baixa', '{"en": "Low-Cable Biceps Curl", "es": "Curl de bíceps en polea baja", "fr": "Curl biceps à la poulie basse"}'::jsonb),
    ('Bíceps Rosca martelo com halter', '{"en": "Dumbbell Hammer Curl", "es": "Curl martillo con mancuerna", "fr": "Curl marteau avec haltère"}'::jsonb),
    ('Triceps Testa', '{"en": "Skull Crusher", "es": "Press francés (rompecráneos)", "fr": "Barre au front"}'::jsonb),
    ('Pull down barra reta (polia alta)', '{"en": "Straight-Bar Pulldown (High Cable)", "es": "Pull-down con barra recta (polea alta)", "fr": "Pull-down barre droite (poulie haute)"}'::jsonb),
    ('Side to side Squat alternado', '{"en": "Alternating Side-to-Side Squat", "es": "Sentadilla lateral alterna", "fr": "Squat latéral alterné"}'::jsonb),
    ('Elevação Pélvica chão', '{"en": "Glute Bridge", "es": "Puente de glúteos", "fr": "Pont fessier au sol"}'::jsonb),
    ('Butt Kick', '{"en": "Butt Kicks", "es": "Talones al glúteo", "fr": "Talons-fesses"}'::jsonb),
    ('Afundo com halteres (step)', '{"en": "Dumbbell Step-Up Lunge", "es": "Zancada con mancuernas (step)", "fr": "Fente avec haltères (step)"}'::jsonb),
    ('Agachamento barra guiada Smith', '{"en": "Smith Machine Squat", "es": "Sentadilla en máquina Smith", "fr": "Squat à la Smith machine"}'::jsonb),
    ('Elevação Pélvica máquina', '{"en": "Machine Hip Thrust", "es": "Hip thrust en máquina", "fr": "Hip thrust à la machine"}'::jsonb),
    ('Stiff barra livre', '{"en": "Barbell Stiff-Leg Deadlift", "es": "Peso muerto rígido con barra", "fr": "Soulevé de terre jambes tendues (barre)"}'::jsonb),
    ('Mesa Flexora', '{"en": "Lying Leg Curl", "es": "Curl femoral tumbado", "fr": "Leg curl allongé"}'::jsonb),
    ('Glúteo na polia (perna esticada)', '{"en": "Cable Glute Kickback (Straight Leg)", "es": "Patada de glúteo en polea (pierna estirada)", "fr": "Kickback fessier à la poulie (jambe tendue)"}'::jsonb),
    ('Corrida', '{"en": "Running", "es": "Carrera", "fr": "Course"}'::jsonb),
    ('Bíceps na Máquina', '{"en": "Machine Biceps Curl", "es": "Curl de bíceps en máquina", "fr": "Curl biceps à la machine"}'::jsonb),
    ('Tríceps na Máquina', '{"en": "Machine Triceps Extension", "es": "Extensión de tríceps en máquina", "fr": "Extension triceps à la machine"}'::jsonb),
    ('Remada unilateral com halter', '{"en": "One-Arm Dumbbell Row", "es": "Remo unilateral con mancuerna", "fr": "Rowing unilatéral avec haltère"}'::jsonb),
    ('Desenvolvimento com halteres', '{"en": "Dumbbell Shoulder Press", "es": "Press de hombros con mancuernas", "fr": "Développé épaules avec haltères"}'::jsonb),
    ('Puxada frente na polia', '{"en": "Cable Lat Pulldown", "es": "Jalón al pecho en polea", "fr": "Tirage vertical à la poulie"}'::jsonb),
    ('Mergulho no banco', '{"en": "Bench Dips", "es": "Fondos en banco", "fr": "Dips sur banc"}'::jsonb),
    ('Tríceps francês com halter', '{"en": "Dumbbell Overhead Triceps Extension", "es": "Extensión de tríceps sobre la cabeza con mancuerna", "fr": "Extension triceps nuque avec haltère"}'::jsonb),
    ('Stiff com halteres', '{"en": "Dumbbell Stiff-Leg Deadlift", "es": "Peso muerto rígido con mancuernas", "fr": "Soulevé de terre jambes tendues (haltères)"}'::jsonb),
    ('Crucifixo com halteres', '{"en": "Dumbbell Fly", "es": "Aperturas con mancuernas", "fr": "Écarté couché avec haltères"}'::jsonb),
    ('Hip thrust com barra', '{"en": "Barbell Hip Thrust", "es": "Hip thrust con barra", "fr": "Hip thrust à la barre"}'::jsonb),
    ('Flexão de braço', '{"en": "Push-Up", "es": "Flexiones", "fr": "Pompes"}'::jsonb),
    ('Face pull na polia', '{"en": "Cable Face Pull", "es": "Face pull en polea", "fr": "Face pull à la poulie"}'::jsonb),
    ('Cadeira Abdutora', '{"en": "Hip Abduction Machine", "es": "Abductores en máquina", "fr": "Abducteurs à la machine"}'::jsonb),
    ('Passada com halteres', '{"en": "Dumbbell Walking Lunge", "es": "Zancadas con mancuernas", "fr": "Fentes marchées avec haltères"}'::jsonb),
    ('Cadeira Adutora', '{"en": "Hip Adduction Machine", "es": "Aductores en máquina", "fr": "Adducteurs à la machine"}'::jsonb),
    ('Elevação lateral na polia', '{"en": "Cable Lateral Raise", "es": "Elevación lateral en polea", "fr": "Élévation latérale à la poulie"}'::jsonb),
    ('Panturrilha sentado', '{"en": "Seated Calf Raise", "es": "Gemelos sentado", "fr": "Mollets assis"}'::jsonb),
    ('Remada baixa na polia', '{"en": "Seated Cable Row", "es": "Remo bajo en polea", "fr": "Tirage horizontal à la poulie"}'::jsonb),
    ('Superman', '{"en": "Superman", "es": "Superman", "fr": "Superman"}'::jsonb),
    ('Rosca direta com barra', '{"en": "Barbell Curl", "es": "Curl de bíceps con barra", "fr": "Curl biceps à la barre"}'::jsonb),
    ('Rosca alternada com halteres', '{"en": "Alternating Dumbbell Curl", "es": "Curl alterno con mancuernas", "fr": "Curl alterné avec haltères"}'::jsonb),
    ('Agachamento hack', '{"en": "Hack Squat", "es": "Sentadilla hack", "fr": "Hack squat"}'::jsonb),
    ('Crossover na polia', '{"en": "Cable Crossover", "es": "Cruce de poleas", "fr": "Écarté à la poulie (vis-à-vis)"}'::jsonb),
    ('Agachamento goblet', '{"en": "Goblet Squat", "es": "Sentadilla goblet", "fr": "Goblet squat"}'::jsonb),
    ('Supino reto com halteres', '{"en": "Dumbbell Bench Press", "es": "Press de banca con mancuernas", "fr": "Développé couché avec haltères"}'::jsonb),
    ('Panturrilha em pé', '{"en": "Standing Calf Raise", "es": "Gemelos de pie", "fr": "Mollets debout"}'::jsonb),
    ('Hiperextensão no banco', '{"en": "Back Extension (Bench)", "es": "Hiperextensiones en banco", "fr": "Extension lombaire sur banc"}'::jsonb)
)
update public.exercises e
set name_i18n = t.name_i18n
from translations t
where e.owner_id is null
  and lower(btrim(e.name)) = lower(btrim(t.name));

-- No catalogue tips: the coach's notes are the only text under an exercise.
update public.exercises
set tip = null,
    tip_i18n = null
where owner_id is null
  and (tip is not null or tip_i18n is not null);

commit;

-- Check: every catalogue exercise should have a translated name (expect 0 rows).
-- select id, name from public.exercises where owner_id is null and name_i18n is null;
