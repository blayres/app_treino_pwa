import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const RAPIDAPI_KEY = process.env.EXERCISEDB_API_KEY ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RAPIDAPI_KEY) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or EXERCISEDB_API_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

function normalize(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function slugify(str: string): string {
    return normalize(str).replace(/\s+/g, '-');
}

const RAPID_ALIASES: Record<string, string> = {
    'ab crunch machine': 'cable seated crunch',
    'alternate hammer curl': 'alternate hammer curl',
    'band assisted pull up': 'band assisted pull-up',
    'barbell glute bridge': 'barbell glute bridge',
    'barbell hip thrust': 'barbell hip thrust',
    'barbell squat': 'barbell full squat',
    'cable seated lateral raise': 'cable lateral raise',
    'close grip front lat pulldown': 'cable close grip front lat pulldown',
    'crucifix': 'dumbbell reverse fly',
    'romanian deadlift': 'barbell romanian deadlift',
    'double leg butt kick': 'butt kick',
    'dumbbell lunges': 'dumbbell lunge',
    'dumbbell shoulder press': 'dumbbell seated shoulder press',
    'fast skipping': 'skipping',
    'flat bench lying leg raise': 'lying leg raise',
    'high cable curls': 'cable biceps curl',
    'hyperextensions back extensions': 'hyperextension',
    'leg extensions': 'lever leg extension',
    'leg press': 'sled 45° leg press',
    'lying leg curls': 'lever lying leg curl',
    'plank': 'front plank',
    'reverse flyes': 'dumbbell reverse fly',
    'reverse grip bent over rows': 'barbell reverse grip bent over row',
    'seated cable rows': 'cable seated row',
    'seated leg curl': 'lever seated leg curl',
    'smith machine squat': 'smith squat',
    'straight arm pulldown': 'cable straight arm pulldown',
};

type RapidExercise = {
    id: string;
    name: string;
    bodyPart?: string;
    target?: string;
    equipment?: string;
    secondaryMuscles?: string[];
    instructions?: string[];
};

async function fetchRapidExercises(): Promise<RapidExercise[]> {
    const res = await fetch('https://exercisedb.p.rapidapi.com/exercises?limit=1500', {
        headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        },
    });

    if (!res.ok) {
        throw new Error(`RapidAPI exercises error: ${res.status} ${await res.text()}`);
    }

    const data: any = await res.json();

    console.log('RapidAPI response type:', Array.isArray(data) ? 'array' : typeof data);
    console.log('RapidAPI sample:', JSON.stringify(data).slice(0, 1000));

    if (Array.isArray(data)) {
        return data as RapidExercise[];
    }

    if (data && Array.isArray(data.data)) {
        return data.data as RapidExercise[];
    }

    if (data && Array.isArray(data.exercises)) {
        return data.exercises as RapidExercise[];
    }

    throw new Error('Unexpected RapidAPI response format');
}

async function searchRapidExerciseByName(name: string): Promise<RapidExercise | null> {
    const res = await fetch(
        `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name)}?offset=0&limit=10`,
        {
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
            },
        }
    );

    if (!res.ok) {
        console.warn(`RapidAPI search failed for "${name}": ${res.status} ${await res.text()}`);
        return null;
    }

    const data: any = await res.json();
    const results = Array.isArray(data) ? data : data?.data;

    return results?.[0] ?? null;
}

async function downloadExerciseGif(exerciseId: string): Promise<Uint8Array> {
    const res = await fetch(
        `https://exercisedb.p.rapidapi.com/image?exerciseId=${exerciseId}&resolution=180`,
        {
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
            },
        }
    );

    if (!res.ok) {
        throw new Error(`Failed GIF ${exerciseId}: ${res.status} ${await res.text()}`);
    }

    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
}

async function uploadGifToSupabase(
    exerciseLibraryId: string,
    exerciseName: string,
    gifBytes: Uint8Array
): Promise<string> {
    const path = `${exerciseLibraryId}-${slugify(exerciseName)}.gif`;

    const { error } = await supabase.storage
        .from('exercise-gifs')
        .upload(path, gifBytes, {
            contentType: 'image/gif',
            upsert: true,
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from('exercise-gifs')
        .getPublicUrl(path);

    return data.publicUrl;
}

async function main() {
    console.log('Fetching linked exercises from Supabase...');

    const { data: appExercises, error: exErr } = await supabase
        .from('exercises')
        .select('exercise_library_id')
        .not('exercise_library_id', 'is', null);

    if (exErr) throw exErr;

    const libraryIds = Array.from(
        new Set(appExercises?.map(e => e.exercise_library_id).filter(Boolean))
    );

    console.log(`Found ${libraryIds.length} linked library exercises.`);

    const { data: libraryRows, error: libErr } = await supabase
        .from('exercise_library')
        .select('id, name, name_pt')
        .in('id', libraryIds);

    if (libErr) throw libErr;
    if (!libraryRows?.length) {
        console.log('No exercise_library rows found.');
        return;
    }

    let updated = 0;
    let unmatched = 0;

    for (const row of libraryRows) {
        const searchName = normalize(row.name_pt || row.name);
        const aliasName = RAPID_ALIASES[searchName];

        const candidates = [
            aliasName,
            row.name_pt,
            row.name,
        ].filter(Boolean) as string[];

        let rapid: RapidExercise | null = null;

        for (const candidate of candidates) {
            rapid = await searchRapidExerciseByName(candidate);

            if (rapid) {
                console.log(`✓ Match: ${row.name} -> ${rapid.name} using "${candidate}"`);
                break;
            }
        }

        if (!rapid) {
            console.log(`✗ No RapidAPI match for: ${row.name} (alias: ${aliasName ?? 'none'})`);
            unmatched++;
            continue;
        }

        try {
            console.log(`Downloading GIF: ${row.name} -> ${rapid.name}`);

            const gifBytes = await downloadExerciseGif(rapid.id);
            const publicUrl = await uploadGifToSupabase(row.id, rapid.name, gifBytes);

            const { error: updateErr } = await supabase
                .from('exercise_library')
                .update({
                    gif_url: publicUrl,
                    source: 'free-exercise-db+rapidapi-gif',
                })
                .eq('id', row.id);

            if (updateErr) throw updateErr;

            console.log(`✓ Updated ${row.name}`);
            updated++;
        } catch (err) {
            console.error(`✗ Failed ${row.name}`, err);
        }
    }

    console.log(`Done. Updated: ${updated}. Unmatched: ${unmatched}.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

