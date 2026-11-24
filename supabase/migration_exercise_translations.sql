-- Migration: translated exercise names and tips (en / es / fr)
-- Apply in the Supabase SQL Editor BEFORE deploying the app version that reads them.
-- Idempotent: safe to run again.
--
-- The catalogue stays in Portuguese in exercises.name / exercises.tip (the
-- reference text, also used to match exercises by name). The translations go in
-- two JSON columns: {"en": "...", "es": "...", "fr": "..."}. The app shows the
-- user's language and falls back to Portuguese when a translation is missing.
-- Exercises created by users (owner_id not null) keep only what they typed.
--
-- Undo: alter table public.exercises drop column if exists name_i18n, drop column if exists tip_i18n;

begin;

alter table public.exercises add column if not exists name_i18n jsonb;
alter table public.exercises add column if not exists tip_i18n jsonb;

comment on column public.exercises.name_i18n is 'Name in other languages: {"en","es","fr"}; Portuguese is exercises.name.';
comment on column public.exercises.tip_i18n is 'Tip in other languages: {"en","es","fr"}; Portuguese is exercises.tip.';

-- Global catalogue only, matched by its Portuguese name.
with translations (name, name_i18n, tip_i18n) as (
  values
    ('Leg Press 45° Perna Aberta', '{"en": "45° Leg Press (Wide Stance)", "es": "Prensa de piernas 45° (piernas abiertas)", "fr": "Presse à cuisses 45° (pieds écartés)"}'::jsonb, null::jsonb),
    ('Cadeira Extensora', '{"en": "Leg Extension", "es": "Extensión de cuádriceps en máquina", "fr": "Leg extension (machine)"}'::jsonb, '{"en": "Partial range (0–60°). Moderate load. Strengthens without stressing the knee.", "es": "Amplitud parcial (0–60°). Carga moderada. Fortalece sin estresar la rodilla.", "fr": "Amplitude partielle (0–60°). Charge modérée. Renforce sans solliciter le genou."}'::jsonb),
    ('Agachamento Sumô', '{"en": "Sumo Squat", "es": "Sentadilla sumo", "fr": "Squat sumo"}'::jsonb, '{"en": "Toes turned out 45°. Slow descent (3 s), explosive ascent. Great for hamstrings and adductors.", "es": "Puntas de los pies abiertas a 45°. Bajada lenta (3 s), subida explosiva. Ideal para isquiotibiales y aductores.", "fr": "Pointes de pieds ouvertes à 45°. Descente lente (3 s), montée explosive. Idéal pour les ischios et les adducteurs."}'::jsonb),
    ('Afundo', '{"en": "Lunge", "es": "Zancada", "fr": "Fente"}'::jsonb, null::jsonb),
    ('Abdutora 45°', '{"en": "45° Hip Abduction", "es": "Abducción de cadera 45°", "fr": "Abduction de hanche 45°"}'::jsonb, '{"en": "Hold the squeeze at the top for 1 s. The gluteus medius helps round out the glutes.", "es": "Contracción arriba durante 1 s. El glúteo medio ayuda a redondear los glúteos.", "fr": "Contraction en haut pendant 1 s. Le moyen fessier aide à arrondir les fessiers."}'::jsonb),
    ('Remada na Máquina', '{"en": "Machine Row", "es": "Remo en máquina", "fr": "Rowing à la machine"}'::jsonb, '{"en": "Pull your shoulder blades back before pulling. Don''t round your lower back. A key base for working up to pull-ups.", "es": "Retrae las escápulas antes de tirar. No redondees la zona lumbar. Base esencial para llegar a las dominadas.", "fr": "Rétractez les omoplates avant de tirer. N''arrondissez pas le bas du dos. Base essentielle pour arriver aux tractions."}'::jsonb),
    ('Graviton', '{"en": "Assisted Pull-Up (Graviton)", "es": "Dominadas asistidas (Graviton)", "fr": "Tractions assistées (Graviton)"}'::jsonb, '{"en": "Shoulder blades back, elbows pointing down. Lower the counterweight by 2.5 kg every 2 weeks you complete all sets.", "es": "Escápulas retraídas, codos hacia abajo. Reduce 2,5 kg de contrapeso cada 2 semanas en que completes todas las series.", "fr": "Omoplates rétractées, coudes vers le bas. Retirez 2,5 kg de contrepoids toutes les 2 semaines où vous terminez toutes les séries."}'::jsonb),
    ('Fly Inverso', '{"en": "Reverse Fly", "es": "Aperturas invertidas", "fr": "Écarté inversé"}'::jsonb, '{"en": "Light load, full range. Improves posture and relieves neck tension.", "es": "Carga ligera, amplitud completa. Corrige la postura y alivia la tensión cervical.", "fr": "Charge légère, amplitude complète. Corrige la posture et soulage les tensions cervicales."}'::jsonb),
    ('Desenvolvimento no Banco', '{"en": "Bench Shoulder Press", "es": "Press de hombros en banco", "fr": "Développé épaules sur banc"}'::jsonb, '{"en": "Bench at 80°. Strengthens the shoulders and improves posture.", "es": "Banco a 80°. Fortalece el hombro y mejora la postura.", "fr": "Banc à 80°. Renforce les épaules et améliore la posture."}'::jsonb),
    ('Bíceps + Tríceps Máquina', '{"en": "Biceps + Triceps (Machine)", "es": "Bíceps + tríceps en máquina", "fr": "Biceps + triceps à la machine"}'::jsonb, null::jsonb),
    ('Lombar', '{"en": "Lower Back Extension", "es": "Extensión lumbar", "fr": "Extension lombaire"}'::jsonb, '{"en": "Don''t hyperextend at the top. Strengthens the posterior chain and prevents lower-back pain.", "es": "Sin hiperextender al final. Fortalece la cadena posterior y previene el dolor lumbar.", "fr": "Sans hyperextension en fin de mouvement. Renforce la chaîne postérieure et prévient le mal de dos."}'::jsonb),
    ('Prancha', '{"en": "Plank", "es": "Plancha", "fr": "Gainage (planche)"}'::jsonb, '{"en": "Neutral hips. Breathe normally. Add 5 s each week.", "es": "Cadera neutra. Respira con normalidad. Añade 5 s por semana.", "fr": "Bassin neutre. Respirez normalement. Ajoutez 5 s par semaine."}'::jsonb),
    ('Abdominal Crunch', '{"en": "Crunch", "es": "Crunch abdominal", "fr": "Crunch abdominal"}'::jsonb, '{"en": "Hold the squeeze at the top for 1 s. Don''t pull on your neck.", "es": "Contracción arriba durante 1 s. Sin tirar del cuello.", "fr": "Contraction en haut pendant 1 s. Sans tirer sur la nuque."}'::jsonb),
    ('Elevação de Pernas', '{"en": "Leg Raise", "es": "Elevación de piernas", "fr": "Relevé de jambes"}'::jsonb, '{"en": "Lower back pressed to the bench. Controlled descent. Focus on the lower abs.", "es": "Zona lumbar pegada al banco. Bajada controlada. Foco en el abdomen inferior.", "fr": "Bas du dos collé au banc. Descente contrôlée. Focus sur le bas des abdos."}'::jsonb),
    ('Panturrilha no Leg Press', '{"en": "Calf Press on Leg Press", "es": "Gemelos en prensa", "fr": "Mollets à la presse"}'::jsonb, '{"en": "Full range. 1 s pause at the top. Strong calves = more efficient running.", "es": "Amplitud completa. Pausa de 1 s arriba. Gemelos fuertes = carrera más eficiente.", "fr": "Amplitude complète. Pause de 1 s en haut. Mollets forts = course plus efficace."}'::jsonb),
    ('Stiff', '{"en": "Stiff-Leg Deadlift", "es": "Peso muerto con piernas rígidas", "fr": "Soulevé de terre jambes tendues"}'::jsonb, '{"en": "Knees slightly bent. Push your hips back, don''t round your spine. Maximum controlled range.", "es": "Rodillas semiflexionadas. Lleva la cadera hacia atrás, sin curvar la espalda. Amplitud máxima controlada.", "fr": "Genoux légèrement fléchis. Poussez les hanches vers l''arrière sans arrondir le dos. Amplitude maximale contrôlée."}'::jsonb),
    ('Búlgaro', '{"en": "Bulgarian Split Squat", "es": "Sentadilla búlgara", "fr": "Squat bulgare"}'::jsonb, null::jsonb),
    ('Cadeira Flexora', '{"en": "Seated Leg Curl", "es": "Curl femoral sentado", "fr": "Leg curl assis"}'::jsonb, '{"en": "Leg curl. Control the descent over 3 s. High volume to build up a weak point.", "es": "Curl femoral. Controla la bajada en 3 s. Volumen alto para desarrollar el punto débil.", "fr": "Leg curl. Contrôlez la descente en 3 s. Volume élevé pour développer le point faible."}'::jsonb),
    ('Supino na Máquina', '{"en": "Seated Machine Chest Press", "es": "Press de pecho en máquina", "fr": "Développé pectoral assis (machine)"}'::jsonb, '{"en": "Safe, controlled movement. Don''t arch your lower back.", "es": "Control seguro. No arquees la zona lumbar.", "fr": "Mouvement contrôlé. Ne cambrez pas le bas du dos."}'::jsonb),
    ('Leg Press 45°', '{"en": "45° Leg Press", "es": "Prensa de piernas 45°", "fr": "Presse à cuisses 45°"}'::jsonb, '{"en": "Feet hip-width apart. Lower to 90°, push through your heels.", "es": "Pies a la anchura de la cadera. Baja hasta 90°, empuja con los talones.", "fr": "Pieds écartés largeur de hanches. Descendez jusqu''à 90°, poussez avec les talons."}'::jsonb),
    ('Puxada Alta na Máquina', '{"en": "Machine Lat Pulldown", "es": "Jalón al pecho en máquina", "fr": "Tirage vertical à la machine"}'::jsonb, null::jsonb),
    ('Rosca Bíceps na Polia', '{"en": "Cable Biceps Curl", "es": "Curl de bíceps en polea", "fr": "Curl biceps à la poulie"}'::jsonb, null::jsonb),
    ('Agachamento na Máquina', '{"en": "Machine Squat", "es": "Sentadilla en máquina", "fr": "Squat à la machine"}'::jsonb, null::jsonb),
    ('Desenvolvimento na Máquina', '{"en": "Machine Shoulder Press", "es": "Press de hombros en máquina", "fr": "Développé épaules à la machine"}'::jsonb, null::jsonb),
    ('Tríceps na Polia', '{"en": "Cable Triceps Pushdown", "es": "Extensión de tríceps en polea", "fr": "Extension triceps à la poulie"}'::jsonb, null::jsonb),
    ('Agachamento Livre (barra)', '{"en": "Barbell Back Squat", "es": "Sentadilla libre con barra", "fr": "Squat libre à la barre"}'::jsonb, '{"en": "Bar on your traps, feet hip-width apart. Lower to 90°. No excessive weight — technique first.", "es": "Barra sobre el trapecio, pies a la anchura de la cadera. Baja hasta 90°. Sin peso excesivo: primero la técnica.", "fr": "Barre sur les trapèzes, pieds largeur de hanches. Descendez jusqu''à 90°. Pas de charge excessive : la technique d''abord."}'::jsonb),
    ('Bíceps + Tríceps Combinado', '{"en": "Biceps + Triceps Superset", "es": "Bíceps + tríceps combinado", "fr": "Biceps + triceps en superset"}'::jsonb, '{"en": "Alternate biceps and triceps on the cable with no rest in between. Rest 60 s after each pair.", "es": "Alterna bíceps y tríceps en polea sin descanso entre ambos. Descansa 60 s después de cada par.", "fr": "Alternez biceps et triceps à la poulie sans repos entre les deux. Reposez-vous 60 s après chaque paire."}'::jsonb),
    ('Remada Curvada carga leve', '{"en": "Bent-Over Row (Light)", "es": "Remo inclinado (carga ligera)", "fr": "Rowing buste penché (charge légère)"}'::jsonb, '{"en": "Warm-up", "es": "Calentamiento", "fr": "Échauffement"}'::jsonb),
    ('Mackenzie dinâmico', '{"en": "Dynamic McKenzie", "es": "McKenzie dinámico", "fr": "McKenzie dynamique"}'::jsonb, '{"en": "Mobility", "es": "Movilidad", "fr": "Mobilité"}'::jsonb),
    ('Mobilidade ombros dinâmico de joelhos e braços esticados', '{"en": "Dynamic Shoulder Mobility (Kneeling, Arms Straight)", "es": "Movilidad dinámica de hombros (de rodillas, brazos estirados)", "fr": "Mobilité dynamique des épaules (à genoux, bras tendus)"}'::jsonb, '{"en": "Mobility", "es": "Movilidad", "fr": "Mobilité"}'::jsonb),
    ('Skipping', '{"en": "High Knees", "es": "Skipping", "fr": "Montées de genoux"}'::jsonb, '{"en": "Cardio", "es": "Cardio", "fr": "Cardio"}'::jsonb),
    ('Remada Curvada Pronada barra livre', '{"en": "Overhand Barbell Bent-Over Row", "es": "Remo inclinado con barra (agarre prono)", "fr": "Rowing barre buste penché (prise pronation)"}'::jsonb, '{"en": "9-11 + drop set", "es": "9-11 + drop set", "fr": "9-11 + drop set"}'::jsonb),
    ('Supino Reto máquina deitado', '{"en": "Lying Machine Chest Press", "es": "Press de banca en máquina (tumbado)", "fr": "Développé couché (machine)"}'::jsonb, '{"en": "progressive", "es": "progresivo", "fr": "progressif"}'::jsonb),
    ('Elevação lateral', '{"en": "Lateral Raise", "es": "Elevaciones laterales", "fr": "Élévations latérales"}'::jsonb, '{"en": "drop set + cardio", "es": "drop set + cardio", "fr": "drop set + cardio"}'::jsonb),
    ('Cardio superior', '{"en": "Upper-Body Cardio", "es": "Cardio de tren superior", "fr": "Cardio haut du corps"}'::jsonb, null::jsonb),
    ('Desenvolvimento de ombros máquina sentado', '{"en": "Seated Machine Shoulder Press", "es": "Press de hombros en máquina sentado", "fr": "Développé épaules assis (machine)"}'::jsonb, null::jsonb),
    ('Crucifixo Inverso com halter', '{"en": "Dumbbell Reverse Fly", "es": "Aperturas invertidas con mancuerna", "fr": "Oiseau avec haltères"}'::jsonb, null::jsonb),
    ('Bíceps Rosca direta polia baixa', '{"en": "Low-Cable Biceps Curl", "es": "Curl de bíceps en polea baja", "fr": "Curl biceps à la poulie basse"}'::jsonb, null::jsonb),
    ('Bíceps Rosca martelo com halter', '{"en": "Dumbbell Hammer Curl", "es": "Curl martillo con mancuerna", "fr": "Curl marteau avec haltère"}'::jsonb, null::jsonb),
    ('Triceps Testa', '{"en": "Skull Crusher", "es": "Press francés (rompecráneos)", "fr": "Barre au front"}'::jsonb, null::jsonb),
    ('Pull down barra reta (polia alta)', '{"en": "Straight-Bar Pulldown (High Cable)", "es": "Pull-down con barra recta (polea alta)", "fr": "Pull-down barre droite (poulie haute)"}'::jsonb, null::jsonb),
    ('Side to side Squat alternado', '{"en": "Alternating Side-to-Side Squat", "es": "Sentadilla lateral alterna", "fr": "Squat latéral alterné"}'::jsonb, null::jsonb),
    ('Elevação Pélvica chão', '{"en": "Glute Bridge", "es": "Puente de glúteos", "fr": "Pont fessier au sol"}'::jsonb, null::jsonb),
    ('Butt Kick', '{"en": "Butt Kicks", "es": "Talones al glúteo", "fr": "Talons-fesses"}'::jsonb, null::jsonb),
    ('Afundo com halteres (step)', '{"en": "Dumbbell Step-Up Lunge", "es": "Zancada con mancuernas (step)", "fr": "Fente avec haltères (step)"}'::jsonb, null::jsonb),
    ('Agachamento barra guiada Smith', '{"en": "Smith Machine Squat", "es": "Sentadilla en máquina Smith", "fr": "Squat à la Smith machine"}'::jsonb, null::jsonb),
    ('Elevação Pélvica máquina', '{"en": "Machine Hip Thrust", "es": "Hip thrust en máquina", "fr": "Hip thrust à la machine"}'::jsonb, null::jsonb),
    ('Stiff barra livre', '{"en": "Barbell Stiff-Leg Deadlift", "es": "Peso muerto rígido con barra", "fr": "Soulevé de terre jambes tendues (barre)"}'::jsonb, null::jsonb),
    ('Mesa Flexora', '{"en": "Lying Leg Curl", "es": "Curl femoral tumbado", "fr": "Leg curl allongé"}'::jsonb, null::jsonb),
    ('Glúteo na polia (perna esticada)', '{"en": "Cable Glute Kickback (Straight Leg)", "es": "Patada de glúteo en polea (pierna estirada)", "fr": "Kickback fessier à la poulie (jambe tendue)"}'::jsonb, null::jsonb),
    ('Corrida', '{"en": "Running", "es": "Carrera", "fr": "Course"}'::jsonb, null::jsonb),
    ('Bíceps na Máquina', '{"en": "Machine Biceps Curl", "es": "Curl de bíceps en máquina", "fr": "Curl biceps à la machine"}'::jsonb, '{"en": "Full control on the way down. High rep range for definition without excess bulk.", "es": "Control total en la bajada. Rango alto de repeticiones para definir sin volumen excesivo.", "fr": "Contrôle total à la descente. Séries longues pour dessiner sans prendre trop de volume."}'::jsonb),
    ('Tríceps na Máquina', '{"en": "Machine Triceps Extension", "es": "Extensión de tríceps en máquina", "fr": "Extension triceps à la machine"}'::jsonb, '{"en": "Elbows fixed. Full extension without locking the joint.", "es": "Codos fijos. Extensión completa sin bloquear la articulación.", "fr": "Coudes fixes. Extension complète sans verrouiller l''articulation."}'::jsonb),
    ('Remada unilateral com halter', '{"en": "One-Arm Dumbbell Row", "es": "Remo unilateral con mancuerna", "fr": "Rowing unilatéral avec haltère"}'::jsonb, null::jsonb),
    ('Desenvolvimento com halteres', '{"en": "Dumbbell Shoulder Press", "es": "Press de hombros con mancuernas", "fr": "Développé épaules avec haltères"}'::jsonb, null::jsonb),
    ('Puxada frente na polia', '{"en": "Cable Lat Pulldown", "es": "Jalón al pecho en polea", "fr": "Tirage vertical à la poulie"}'::jsonb, null::jsonb),
    ('Mergulho no banco', '{"en": "Bench Dips", "es": "Fondos en banco", "fr": "Dips sur banc"}'::jsonb, null::jsonb),
    ('Tríceps francês com halter', '{"en": "Dumbbell Overhead Triceps Extension", "es": "Extensión de tríceps sobre la cabeza con mancuerna", "fr": "Extension triceps nuque avec haltère"}'::jsonb, null::jsonb),
    ('Stiff com halteres', '{"en": "Dumbbell Stiff-Leg Deadlift", "es": "Peso muerto rígido con mancuernas", "fr": "Soulevé de terre jambes tendues (haltères)"}'::jsonb, null::jsonb),
    ('Crucifixo com halteres', '{"en": "Dumbbell Fly", "es": "Aperturas con mancuernas", "fr": "Écarté couché avec haltères"}'::jsonb, null::jsonb),
    ('Hip thrust com barra', '{"en": "Barbell Hip Thrust", "es": "Hip thrust con barra", "fr": "Hip thrust à la barre"}'::jsonb, null::jsonb),
    ('Flexão de braço', '{"en": "Push-Up", "es": "Flexiones", "fr": "Pompes"}'::jsonb, null::jsonb),
    ('Face pull na polia', '{"en": "Cable Face Pull", "es": "Face pull en polea", "fr": "Face pull à la poulie"}'::jsonb, null::jsonb),
    ('Cadeira Abdutora', '{"en": "Hip Abduction Machine", "es": "Abductores en máquina", "fr": "Abducteurs à la machine"}'::jsonb, null::jsonb),
    ('Passada com halteres', '{"en": "Dumbbell Walking Lunge", "es": "Zancadas con mancuernas", "fr": "Fentes marchées avec haltères"}'::jsonb, null::jsonb),
    ('Cadeira Adutora', '{"en": "Hip Adduction Machine", "es": "Aductores en máquina", "fr": "Adducteurs à la machine"}'::jsonb, null::jsonb),
    ('Elevação lateral na polia', '{"en": "Cable Lateral Raise", "es": "Elevación lateral en polea", "fr": "Élévation latérale à la poulie"}'::jsonb, null::jsonb),
    ('Panturrilha sentado', '{"en": "Seated Calf Raise", "es": "Gemelos sentado", "fr": "Mollets assis"}'::jsonb, null::jsonb),
    ('Remada baixa na polia', '{"en": "Seated Cable Row", "es": "Remo bajo en polea", "fr": "Tirage horizontal à la poulie"}'::jsonb, null::jsonb),
    ('Superman', '{"en": "Superman", "es": "Superman", "fr": "Superman"}'::jsonb, null::jsonb),
    ('Rosca direta com barra', '{"en": "Barbell Curl", "es": "Curl de bíceps con barra", "fr": "Curl biceps à la barre"}'::jsonb, null::jsonb),
    ('Rosca alternada com halteres', '{"en": "Alternating Dumbbell Curl", "es": "Curl alterno con mancuernas", "fr": "Curl alterné avec haltères"}'::jsonb, null::jsonb),
    ('Agachamento hack', '{"en": "Hack Squat", "es": "Sentadilla hack", "fr": "Hack squat"}'::jsonb, null::jsonb),
    ('Crossover na polia', '{"en": "Cable Crossover", "es": "Cruce de poleas", "fr": "Écarté à la poulie (vis-à-vis)"}'::jsonb, null::jsonb),
    ('Agachamento goblet', '{"en": "Goblet Squat", "es": "Sentadilla goblet", "fr": "Goblet squat"}'::jsonb, null::jsonb),
    ('Supino reto com halteres', '{"en": "Dumbbell Bench Press", "es": "Press de banca con mancuernas", "fr": "Développé couché avec haltères"}'::jsonb, null::jsonb),
    ('Panturrilha em pé', '{"en": "Standing Calf Raise", "es": "Gemelos de pie", "fr": "Mollets debout"}'::jsonb, null::jsonb),
    ('Hiperextensão no banco', '{"en": "Back Extension (Bench)", "es": "Hiperextensiones en banco", "fr": "Extension lombaire sur banc"}'::jsonb, null::jsonb)
)
update public.exercises e
set name_i18n = t.name_i18n,
    tip_i18n = t.tip_i18n
from translations t
where e.owner_id is null
  and lower(btrim(e.name)) = lower(btrim(t.name));

-- The leg curl tip carried a personal note ("favorito dela"): keep only the exercise name.
update public.exercises
set tip = 'Leg curl. Controle a descida em 3s. Volume alto para desenvolver o ponto fraco.'
where owner_id is null
  and lower(btrim(name)) = 'cadeira flexora'
  and tip like 'Leg curl favorito dela%';

commit;

-- Check: every catalogue exercise should have a translated name (expect 0 rows).
-- select id, name from public.exercises where owner_id is null and name_i18n is null;
