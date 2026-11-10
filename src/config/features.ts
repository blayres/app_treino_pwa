/**
 * Feature switches. Flip to true to re-enable.
 *
 * importWorkout: pasting a workout (rule-based parser, coach sheets). Kept off
 * until import is backed by AI (PDF/photo/any text format).
 *
 * coachVideos: trainers' own exercise videos (upload in the trainer area,
 * "Ver vídeo" for students). Off until hosting fits the budget (Supabase free
 * plan: 50 MB per file, 1 GB storage, 5 GB/month egress) — to enable: apply
 * supabase/migration_exercise_videos.sql, then flip to true.
 */
export const FEATURES = {
  importWorkout: false,
  coachVideos: false,
} as const;
