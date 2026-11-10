import { useEffect, useMemo, useState } from 'react';
import { FEATURES } from '../config/features';
import { buildVideoMap, getCachedVideoRows, getVideoRows, type ExerciseVideo, type VideoMap } from '../services/videoService';

const NONE: ExerciseVideo[] = [];

/**
 * Video rows the viewer can read (small list, cached: drawn from cache at
 * once, refreshed in background). The files load only when a video is opened.
 * `reloadKey` forces a fresh read (after an upload/removal).
 */
export function useVideoRows(viewerId: number | null | undefined, reloadKey = 0): ExerciseVideo[] {
  const [rows, setRows] = useState<ExerciseVideo[]>(() => (viewerId ? getCachedVideoRows(viewerId) ?? NONE : NONE));

  useEffect(() => {
    if (!viewerId || !FEATURES.coachVideos) return;
    let cancelled = false;
    getVideoRows(viewerId, { fresh: reloadKey > 0 })
      .then((next) => !cancelled && setRows(next))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [viewerId, reloadKey]);

  return rows;
}

/** exercise id → video to show this viewer (their coach's first). */
export function useExerciseVideos(viewerId: number | null | undefined): VideoMap {
  const rows = useVideoRows(viewerId);
  return useMemo(() => buildVideoMap(rows, viewerId ?? 0), [rows, viewerId]);
}
