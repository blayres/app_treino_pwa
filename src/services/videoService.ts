/**
 * Coaches' own exercise videos (migration_exercise_videos.sql).
 *
 * Performance: screens only load the small list "which exercises have a
 * video" (cached). The file itself is never preloaded: a short-lived signed
 * URL is requested when the user taps "Ver vídeo", and the player streams it.
 */
import { backendMode } from './backendMode';
import { createRequestCache } from './requestCache';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';

export const VIDEO_BUCKET = 'exercise-videos';
/** Supabase free plan upload limit (also set on the bucket). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const EXTENSION_TYPES: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
const SIGNED_URL_SECONDS = 60 * 60;
const LIST_TTL_MS = 5 * 60 * 1000;

export type ExerciseVideo = { exerciseId: number; coachId: number; path: string };
/** exercise id → video (the viewer's coach's, or their own as a coach). */
export type VideoMap = Map<number, ExerciseVideo>;

export type VideoFileProblem = 'notVideo' | 'tooLarge';

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Content type of a picked file (some phones leave `type` empty: use the extension). */
export function videoContentType(file: { name: string; type?: string }): string | null {
  if (file.type && VIDEO_TYPES.includes(file.type)) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? null;
}

export function validateVideoFile(file: { name: string; type?: string; size: number }): VideoFileProblem | null {
  if (!videoContentType(file)) return 'notVideo';
  if (file.size > MAX_VIDEO_BYTES) return 'tooLarge';
  return null;
}

/** "<coach id>/<exercise id>-<timestamp>.<ext>" — a new name per upload, so caches never serve the old video. */
export function videoPath(coachId: number, exerciseId: number, contentType: string, now = Date.now()): string {
  const extension = contentType === 'video/quicktime' ? 'mov' : contentType === 'video/webm' ? 'webm' : 'mp4';
  return `${coachId}/${exerciseId}-${now}.${extension}`;
}

/** Several rows for one exercise (own + coach's): the coach's video wins for a student. */
export function buildVideoMap(rows: ExerciseVideo[], viewerId: number): VideoMap {
  const map: VideoMap = new Map();
  for (const row of rows) {
    const current = map.get(row.exerciseId);
    if (!current || (current.coachId === viewerId && row.coachId !== viewerId)) map.set(row.exerciseId, row);
  }
  return map;
}

// ── Data access ───────────────────────────────────────────────────────────────

/** Rows the viewer can read (RLS: their coach's videos and, for a coach, their own). */
const videoRowsCache = createRequestCache<number, ExerciseVideo[]>(LIST_TTL_MS);

/** The coach's own uploads, by exercise (management screen). */
export function ownVideos(rows: ExerciseVideo[], coachId: number): VideoMap {
  return new Map(rows.filter((row) => row.coachId === coachId).map((row) => [row.exerciseId, row]));
}

/** Last known rows for this viewer (undefined = never loaded). */
export function getCachedVideoRows(viewerId: number): ExerciseVideo[] | undefined {
  return videoRowsCache.peek(viewerId);
}

export function getVideoRows(viewerId: number, options?: { fresh?: boolean }): Promise<ExerciseVideo[]> {
  return videoRowsCache.get(viewerId, fetchVideoRows, { force: options?.fresh });
}

async function fetchVideoRows(): Promise<ExerciseVideo[]> {
  if (backendMode !== 'supabase') return [];
  ensureSupabaseEnabled();
  const { data, error } = await supabase.from('exercise_videos').select('exercise_id, coach_id, storage_path');
  if (error) return []; // migration not applied yet: no videos
  return (data ?? []).map((row: any) => ({
    exerciseId: Number(row.exercise_id),
    coachId: Number(row.coach_id),
    path: String(row.storage_path),
  }));
}

const signedUrls = new Map<string, { url: string; expiresAt: number }>();

/** Streamable URL for a video, created on demand (valid for an hour, reused meanwhile). */
export async function getVideoUrl(path: string): Promise<string> {
  const cached = signedUrls.get(path);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
  ensureSupabaseEnabled();
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error('Video URL unavailable');
  signedUrls.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000 });
  return data.signedUrl;
}

/** Uploads (or replaces) the coach's video for an exercise. */
export async function uploadExerciseVideo(coachId: number, exerciseId: number, file: File): Promise<void> {
  ensureSupabaseEnabled();
  const contentType = videoContentType(file);
  if (!contentType) throw new Error('notVideo');
  const existing = await supabase
    .from('exercise_videos')
    .select('storage_path')
    .eq('coach_id', coachId)
    .eq('exercise_id', exerciseId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const previousPath = (existing.data as any)?.storage_path as string | undefined;
  const path = videoPath(coachId, exerciseId, contentType);

  const upload = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, { contentType, upsert: false });
  if (upload.error) throw upload.error;

  const row = await supabase
    .from('exercise_videos')
    .upsert({ coach_id: coachId, exercise_id: exerciseId, storage_path: path }, { onConflict: 'coach_id,exercise_id' });
  if (row.error) {
    // Don't leave an orphan file behind.
    await supabase.storage.from(VIDEO_BUCKET).remove([path]);
    throw row.error;
  }
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(VIDEO_BUCKET).remove([previousPath]);
    signedUrls.delete(previousPath);
  }
  videoRowsCache.invalidate(coachId);
}

export async function deleteExerciseVideo(coachId: number, video: ExerciseVideo): Promise<void> {
  ensureSupabaseEnabled();
  const { error } = await supabase.from('exercise_videos').delete().eq('coach_id', coachId).eq('exercise_id', video.exerciseId);
  if (error) throw error;
  await supabase.storage.from(VIDEO_BUCKET).remove([video.path]);
  signedUrls.delete(video.path);
  videoRowsCache.invalidate(coachId);
}
