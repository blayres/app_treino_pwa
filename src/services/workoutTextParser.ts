/**
 * Turns a workout pasted as free text into days + exercises, without any AI.
 *
 * Understands the common ways people write workouts, e.g.:
 *
 *   Segunda - Treino A (Costas e Bíceps)
 *   1. Puxada alta 4x10-12
 *   - Remada curvada 3 x 12 descanso 60s
 *   Rosca direta 3 séries de 10
 *
 *   Treino B:
 *   Supino reto 4x8 90"
 *
 * Day headers may be weekdays (pt/en/es/fr, full or abbreviated) or labels such
 * as "Treino A", "Dia 2", "Day 1", "A - Peito". Days without a weekday are
 * assigned to the next free weekday by `assignWeekdays`.
 */

export type ParsedExercise = {
  name: string;
  /** Normalised like the catalogue, e.g. "4x10-12". */
  scheme: string | null;
  restSeconds: number | null;
  /** Coach instructions kept verbatim (cadence, drop-sets, supersets…). */
  notes?: string;
};

export type ParsedDay = {
  /** 1 = Monday … 7 = Sunday; null when the header had no weekday. */
  dayOfWeek: number | null;
  title: string;
  exercises: ParsedExercise[];
};

const WEEKDAYS: [number, string[]][] = [
  [1, ['segunda', 'segunda-feira', 'seg', 'monday', 'mon', 'lunes', 'lun', 'lundi']],
  [2, ['terca', 'terca-feira', 'ter', 'tuesday', 'tue', 'tues', 'martes', 'mar', 'mardi']],
  [3, ['quarta', 'quarta-feira', 'qua', 'wednesday', 'wed', 'miercoles', 'mie', 'mercredi', 'mer']],
  [4, ['quinta', 'quinta-feira', 'qui', 'thursday', 'thu', 'thur', 'thurs', 'jueves', 'jue', 'jeudi', 'jeu']],
  [5, ['sexta', 'sexta-feira', 'sex', 'friday', 'fri', 'viernes', 'vie', 'vendredi', 'ven']],
  [6, ['sabado', 'sab', 'saturday', 'sat', 'samedi', 'sam']],
  [7, ['domingo', 'dom', 'sunday', 'sun', 'dimanche', 'dim']],
];

const WEEKDAY_BY_WORD = new Map<string, number>();
WEEKDAYS.forEach(([day, words]) => words.forEach((word) => WEEKDAY_BY_WORD.set(word, day)));

/** Lowercase, no accents — used for keyword detection only (names keep their case). */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// "4x10", "4 x 10-12", "3X12 a 15", "4×8/10", "3*12"
const SCHEME_X = /(\d{1,2})\s*[x×*]\s*(\d{1,3}(?:\s*(?:-|–|a|\/|ou)\s*\d{1,3})?)(?:\s*(?:reps?|repeti[cç](?:ao|ão|oes|ões)|repeticiones|r[ée]p[ée]titions?))?/i;
// "3 séries de 10", "4 series of 8-10", "3 séries x 12"
const SCHEME_SERIES = /(\d{1,2})\s*(?:s[ée]ries?|sets?)\s*(?:de|of|x|×|de\s+)?\s*(\d{1,3}(?:\s*(?:-|–|a|\/)\s*\d{1,3})?)(?:\s*(?:reps?|repeti[cç](?:ao|ão|oes|ões)))?/i;

// Rest needs either a keyword ("descanso 60", "rest 1min") or an unambiguous
// seconds unit ("60s", "90 seg", '45"'), so "Esteira 10 min" isn't read as rest.
const REST_KEYWORD = /(?<![A-Za-zÀ-ÿ])(?:descanso|intervalo|pausa|rest|repos)\s*:?\s*(\d{1,2}(?:[.,]\d)?)\s*(min(?:utos?)?|m|'|s|seg(?:undos?)?|sec(?:onds?)?|")?/i;
const REST_MIN_SEC = /\b(\d{1,2})\s*(?:'|min|m)\s*(\d{1,2})\s*(?:"|s|seg)?(?=\s|$|[),.;])/i; // 1'30, 1min30
const REST_SECONDS = /(?:^|\s|\()(\d{2,3})\s*(?:s|seg|segs|segundos|sec|secs|seconds|")(?=\s|$|[),.;])/i;

const BULLET = /^\s*(?:[-–—•*·▪►>✓✔]+|\(?\d{1,2}[.)\-:]|\d{1,2}\s+-)\s*/;
const HEADER_LABEL = /^(?:treino|dia|day|workout|entreno|entrenamiento|s[ée]ance|jour|ficha|rotina)\s*[a-z0-9]{0,3}\b/i;
const LETTER_HEADER = /^[A-H]\s*(?:[-–:)]|$)/; // "A - Costas", "B:", "C)"

function normaliseReps(reps: string): string {
  return reps
    .replace(/\s+/g, '')
    .replace(/–/g, '-')
    .replace(/(\d)a(\d)/gi, '$1-$2')
    .replace(/(\d)ou(\d)/gi, '$1/$2');
}

function extractScheme(line: string): { scheme: string | null; rest: string } {
  for (const pattern of [SCHEME_X, SCHEME_SERIES]) {
    const match = line.match(pattern);
    if (match) {
      return {
        scheme: `${match[1]}x${normaliseReps(match[2])}`,
        rest: line.replace(match[0], ' '),
      };
    }
  }
  return { scheme: null, rest: line };
}

function toSeconds(value: string, unit: string | undefined): number {
  const n = Number(value.replace(',', '.'));
  const u = fold(unit ?? '');
  if (u.startsWith('m') || u === "'") return Math.round(n * 60);
  if (!u) return n <= 5 ? Math.round(n * 60) : Math.round(n); // "descanso 2" → 2 min
  return Math.round(n);
}

function extractRest(line: string): { restSeconds: number | null; rest: string } {
  const keyword = line.match(REST_KEYWORD);
  if (keyword) {
    const afterKeyword = line.slice(keyword.index!);
    const minSec = afterKeyword.match(REST_MIN_SEC);
    if (minSec && minSec.index! <= keyword[0].length) {
      const consumed = afterKeyword.slice(0, minSec.index! + minSec[0].length);
      return {
        restSeconds: Number(minSec[1]) * 60 + Number(minSec[2]),
        rest: line.replace(consumed, ' '),
      };
    }
    return { restSeconds: toSeconds(keyword[1], keyword[2]), rest: line.replace(keyword[0], ' ') };
  }
  const minSec = line.match(REST_MIN_SEC);
  if (minSec) {
    return { restSeconds: Number(minSec[1]) * 60 + Number(minSec[2]), rest: line.replace(minSec[0], ' ') };
  }
  const seconds = line.match(REST_SECONDS);
  if (seconds) {
    return { restSeconds: Number(seconds[1]), rest: line.replace(seconds[0], ' ') };
  }
  return { restSeconds: null, rest: line };
}

function cleanName(text: string): string {
  return text
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:|,.;/]+|[\s\-–—:|,.;/(]+$/g, '')
    .trim();
}

/** Weekday found at the start of a line, plus the remaining text. */
function leadingWeekday(line: string): { day: number; remainder: string } | null {
  const match = line.match(/^\s*([A-Za-zÀ-ÿ]+(?:-feira)?)\.?(?=[\s\-–:,(|/]|$)/);
  if (!match) return null;
  const day = WEEKDAY_BY_WORD.get(fold(match[1]));
  if (!day) return null;
  return { day, remainder: cleanName(line.slice(match[0].length)) };
}

function parseHeader(line: string): { dayOfWeek: number | null; title: string } | null {
  const text = line.replace(BULLET, '').replace(/[*_#]+/g, '').trim();
  if (!text) return null;

  const weekday = leadingWeekday(text);
  if (weekday) {
    return { dayOfWeek: weekday.day, title: weekday.remainder };
  }
  if (HEADER_LABEL.test(text) || LETTER_HEADER.test(text)) {
    return { dayOfWeek: null, title: cleanName(text) };
  }
  // "Costas e Bíceps:" — a short line ending with a colon
  if (/:\s*$/.test(text) && text.length <= 60) {
    return { dayOfWeek: null, title: cleanName(text) };
  }
  return null;
}

function parseExercise(line: string): ParsedExercise | null {
  const withoutBullet = line.replace(BULLET, '').replace(/[*_]+/g, '');
  const { scheme, rest: afterScheme } = extractScheme(withoutBullet);
  const { restSeconds, rest: afterRest } = extractRest(afterScheme);
  const name = cleanName(afterRest);
  if (!name || !/[A-Za-zÀ-ÿ]/.test(name)) return null;
  return { name, scheme, restSeconds };
}

export function parseWorkoutText(text: string): ParsedDay[] {
  if (looksLikeCoachSheet(text)) return parseCoachSheet(text);
  return parseSimpleList(text);
}

function parseSimpleList(text: string): ParsedDay[] {
  const days: ParsedDay[] = [];
  let current: ParsedDay | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const hasScheme = SCHEME_X.test(line) || SCHEME_SERIES.test(line);
    const header = hasScheme ? null : parseHeader(line);
    if (header) {
      current = { dayOfWeek: header.dayOfWeek, title: header.title, exercises: [] };
      days.push(current);
      continue;
    }

    const exercise = parseExercise(line);
    if (!exercise) continue;
    if (!current) {
      current = { dayOfWeek: null, title: '', exercises: [] };
      days.push(current);
    }
    current.exercises.push(exercise);
  }

  return days.filter((day) => day.exercises.length > 0);
}

// ── Coach sheets ────────────────────────────────────────────────────────────
// Personal-trainer sheets: one workout per text, exercises are the "-" lines,
// blocks like "PARTE 1: 5 SÉRIES" / "4 Séries" give the sets, the lines below
// an exercise ("Primeira série: 14 a 16 repetições cadência 1010") give reps
// and instructions, and "DESCANSO: 40”" gives the rest for the whole block.

const DASH_LINE = /^\s*[-–—•]\s*(?=\S)/;
const SETS_IN_LINE = /(\d{1,2})\s*s[ée]ries?\b/i;
const BLOCK_HEADER = /^\s*\**\s*(?:parte\s*\d+|aquecimento|bloco\s*\d+|circuito|warm[\s-]?up|part\s*\d+)\b/i;
const SETS_ONLY_LINE = /^\s*\**\s*\d{1,2}\s*s[ée]ries?\s*:?\s*$/i;
const NTH_SERIES_LINE = /^\s*\**\s*(?:primeira|segunda|terceira|quarta|quinta|sexta|s[ée]tima|1[ªa°o]|2[ªa°o]|3[ªa°o]|4[ªa°o]|5[ªa°o]|6[ªa°o])\s*s[ée]rie/i;
const REP_RANGE = /(\d{1,3})\s*(?:a|-|–|até)\s*(\d{1,3})(?=\s*(?:repeti|reps?\b|$))/i;
const REST_LABEL = /descanso\s*:/i;
const WARMUP_NOTE = 'Aquecimento';
// 1’20”, 1'30", 1’, 40”, 45"
const TIME_TOKEN = /(\d{1,2})\s*[’'´]\s*(?:(\d{1,2})\s*[”"])?|(\d{1,3})\s*[”"]/;

export function looksLikeCoachSheet(text: string): boolean {
  const lines = text.split(/\r?\n/);
  const dashLines = lines.filter((line) => DASH_LINE.test(line)).length;
  const structure = lines.filter(
    (line) => !DASH_LINE.test(line) && (SETS_IN_LINE.test(line) || BLOCK_HEADER.test(line) || REST_LABEL.test(line)),
  ).length;
  return dashLines >= 2 && structure >= 1;
}

function parseTime(text: string): number | null {
  const match = text.match(TIME_TOKEN);
  if (!match) return null;
  if (match[3]) return Number(match[3]);
  return Number(match[1]) * 60 + (match[2] ? Number(match[2]) : 0);
}

type CoachExercise = ParsedExercise & {
  /** "3x15" written on the exercise line itself wins over the block's sets. */
  explicitScheme: string | null;
  sets: number | null;
  seriesRanges: string[];
  baseReps: string | null;
  noteLines: string[];
};

function parseCoachExerciseLine(line: string, sets: number | null): CoachExercise {
  let text = line.replace(DASH_LINE, '');
  const noteLines: string[] = [];
  text = text.replace(/\(\s*ver\s+v[íi]deo\s*\)/gi, ' ');
  // "(se não tiver pode fazer o sentado)" is an instruction, not part of the name.
  text = text.replace(/\(\s*(se\s+n[ãa]o[^)]*)\)/gi, (_, note) => {
    noteLines.push(note.trim());
    return ' ';
  });

  const explicit = extractScheme(text);
  const explicitScheme = explicit.scheme;
  if (explicitScheme) text = explicit.rest;

  let baseReps: string | null = null;
  // "12x", "6x com cada perna", "22 total", "30”" (time)
  const repsX = text.match(/(\d{1,3})\s*x\b\s*(.*)$/i);
  const repsTotal = text.match(/(\d{1,3})\s*(?:no\s+)?total\b\s*(.*)$/i);
  const time = text.match(/(\d{1,3})\s*[”"]\s*(.*)$/);
  const inline = explicitScheme ? null : repsX ?? repsTotal;
  if (explicitScheme) {
    // nothing else to read from the line
  } else if (inline) {
    baseReps = inline[1];
    if (inline[2].trim()) noteLines.push(inline[2].trim());
    text = text.slice(0, inline.index);
  } else if (time && !explicitScheme) {
    baseReps = `${time[1]}s`;
    if (time[2].trim()) noteLines.push(time[2].trim());
    text = text.slice(0, time.index);
  }

  return {
    name: cleanName(text),
    scheme: null,
    restSeconds: null,
    explicitScheme,
    sets,
    seriesRanges: [],
    baseReps,
    noteLines,
  };
}

function finishCoachExercise(exercise: CoachExercise): ParsedExercise {
  const ranges = exercise.seriesRanges;
  const sets = ranges.length > 0 ? ranges.length : exercise.sets;
  let reps: string | null = null;
  if (ranges.length > 0) {
    reps = ranges.every((range) => range === ranges[0]) ? ranges[0] : ranges.join('/');
  } else {
    reps = exercise.baseReps;
  }
  const scheme =
    exercise.explicitScheme ?? (reps ? (sets ? `${sets}x${reps}` : reps) : sets ? `${sets}x` : null);
  const notes = exercise.noteLines.join('\n').trim();
  return {
    name: exercise.name,
    scheme,
    restSeconds: exercise.restSeconds,
    ...(notes ? { notes } : {}),
  };
}

function parseCoachSheet(text: string): ParsedDay[] {
  const exercises: CoachExercise[] = [];
  let block: CoachExercise[] = [];
  let sets: number | null = null;
  let isWarmup = false;
  let current: CoachExercise | null = null;

  const applyRest = (line: string) => {
    const afterLabel = line.slice(line.search(REST_LABEL));
    const seconds = parseTime(afterLabel);
    if (seconds != null) block.forEach((exercise) => { if (exercise.restSeconds == null) exercise.restSeconds = seconds; });
    return seconds;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (DASH_LINE.test(line)) {
      current = parseCoachExerciseLine(line, sets);
      if (!current.name) {
        current = null;
        continue;
      }
      if (isWarmup) current.noteLines.unshift(WARMUP_NOTE);
      exercises.push(current);
      block.push(current);
      continue;
    }

    if (BLOCK_HEADER.test(line) && !NTH_SERIES_LINE.test(line)) {
      const setsMatch = line.match(SETS_IN_LINE);
      sets = setsMatch ? Number(setsMatch[1]) : null;
      isWarmup = /aquecimento|warm[\s-]?up/i.test(line);
      block = [];
      current = null;
      continue;
    }

    if (SETS_ONLY_LINE.test(line)) {
      sets = Number(line.match(SETS_IN_LINE)![1]);
      current = null;
      continue;
    }

    // A standalone "DESCANSO: …" line closes the block's rest.
    if (/^\s*\**\s*descanso\s*:/i.test(line)) {
      applyRest(line);
      const extra = line
        .replace(/^\s*\**\s*descanso\s*:\s*/i, '')
        .replace(/\d{1,3}\s*[’'´”"]\s*(\d{1,2}\s*[”"])?/g, '')
        .replace(/\ba\b/g, '')
        .trim();
      const last = block[block.length - 1];
      if (last && /[A-Za-zÀ-ÿ]{3,}/.test(extra)) last.noteLines.push(line.replace(/^\s*\**\s*/, ''));
      continue;
    }

    if (!current) continue;

    // Detail line of the current exercise.
    const detail = line.replace(/^\s*\*+\s*/, '');
    current.noteLines.push(detail);
    const range = detail.match(REP_RANGE);
    if (NTH_SERIES_LINE.test(line)) {
      if (range) current.seriesRanges.push(`${range[1]}-${range[2]}`);
    } else if (range && current.seriesRanges.length === 0 && !current.baseReps) {
      current.baseReps = `${range[1]}-${range[2]}`;
    }
    if (REST_LABEL.test(detail)) applyRest(detail);
  }

  const parsed = exercises.map(finishCoachExercise);
  return parsed.length > 0 ? [{ dayOfWeek: null, title: '', exercises: parsed }] : [];
}

/**
 * Fills missing weekdays with the next free day (Mon→Sun) and drops duplicate
 * weekdays (only one active workout per weekday is allowed). Also gives
 * untitled days a title. Returns a new array.
 */
export function assignWeekdays(
  days: ParsedDay[],
  untitled: (index: number) => string,
  alreadyUsed: Iterable<number> = [],
): ParsedDay[] {
  const used = new Set<number>(alreadyUsed);
  const result = days.map((day) => ({ ...day }));

  result.forEach((day) => {
    if (day.dayOfWeek != null) {
      if (used.has(day.dayOfWeek)) day.dayOfWeek = null;
      else used.add(day.dayOfWeek);
    }
  });

  result.forEach((day) => {
    if (day.dayOfWeek == null) {
      for (let candidate = 1; candidate <= 7; candidate++) {
        if (!used.has(candidate)) {
          day.dayOfWeek = candidate;
          used.add(candidate);
          break;
        }
      }
    }
  });

  return result
    .filter((day) => day.dayOfWeek != null)
    .map((day, index) => ({ ...day, title: day.title || untitled(index) }));
}

// ── Matching against the exercise catalogue ─────────────────────────────────

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'na', 'no', 'nas', 'nos', 'em', 'com',
  'e', 'the', 'with', 'on', 'of', 'en', 'la', 'el', 'con', 'le', 'du', 'des', 'avec', 'sur',
]);

export function normalizeForMatch(name: string): string[] {
  return fold(name)
    .replace(/[^a-z0-9°]+/g, ' ')
    .split(' ')
    .filter((token) => token && !STOPWORDS.has(token));
}

export type CatalogueMatch<T> = { item: T; exact: boolean } | null;

/**
 * Finds the catalogue exercise that best matches a typed/imported name.
 * `exact` = same words (ignoring accents, case, small words and order).
 */
export function matchExercise<T extends { name: string }>(name: string, catalogue: T[]): CatalogueMatch<T> {
  const tokens = normalizeForMatch(name);
  if (tokens.length === 0) return null;
  const key = [...tokens].sort().join(' ');
  const tokenSet = new Set(tokens);

  let best: { item: T; score: number } | null = null;
  for (const item of catalogue) {
    const itemTokens = normalizeForMatch(item.name);
    if (itemTokens.length === 0) continue;
    if ([...itemTokens].sort().join(' ') === key) return { item, exact: true };

    const itemSet = new Set(itemTokens);
    const shared = tokens.filter((token) => itemSet.has(token)).length;
    const union = new Set([...tokenSet, ...itemSet]).size;
    let score = shared / union;
    // "Puxada alta" ⊂ "Puxada Alta na Máquina": a full subset with ≥2 words is a good sign.
    const smaller = Math.min(tokenSet.size, itemSet.size);
    if (shared === smaller && smaller >= 2) score = Math.max(score, 0.75);
    if (!best || score > best.score) best = { item, score };
  }

  return best && best.score >= 0.6 ? { item: best.item, exact: false } : null;
}
