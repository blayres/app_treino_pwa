import { invalidateAttendanceCache, markAttendance } from './attendanceService';
import { stopWorkoutSession } from './sessionService';
import type { ActiveSession } from './types';
import { invalidateWorkoutsByUserCache } from './workoutService';

/** Forgets the exercise checkmarks kept on the device while a workout runs. */
export function clearSessionChecklist(workoutId: number) {
  try {
    localStorage.removeItem(`completedIds:${workoutId}`);
    sessionStorage.removeItem(`completedIds:${workoutId}`);
  } catch { }
}

/**
 * Finishes (or discards) a session in the database, checks the day it started
 * and tells the screens to refresh. Callers update the UI first and run this
 * in the background.
 */
export async function persistSessionEnd(params: {
  userId: number;
  session: ActiveSession;
  cancelOnly: boolean;
}): Promise<void> {
  const { userId, session, cancelOnly } = params;
  const result = await stopWorkoutSession({
    userId,
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    cancelOnly,
  });

  if (result.completed) {
    await markAttendance(userId, result.attendanceDate);
  }

  invalidateAttendanceCache(userId);
  invalidateWorkoutsByUserCache(userId);
  document.dispatchEvent(new Event('workoutSessionUpdated'));
}
