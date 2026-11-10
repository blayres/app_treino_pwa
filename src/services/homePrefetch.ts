import { getAttendanceDatesByMonth } from './attendanceService';
import { getCoachCode, getMyCoach } from './coachService';
import { getProgramReminder } from './programReminder';
import { getWorkoutsByUser } from './workoutService';

/**
 * Starts Home's queries early (during boot) so their caches are filled when
 * Home mounts and it renders with data instead of skeletons. Each screen still
 * loads (and handles errors) on its own. Resolves when the above-the-fold data
 * (week of workouts + this month's check-ins) has arrived or failed.
 */
export function prefetchHomeData(userId: number, now = new Date()): Promise<void> {
  const ignore = () => {};
  getProgramReminder(userId).catch(ignore);
  getCoachCode(userId).catch(ignore);
  getMyCoach(userId).catch(ignore); // Settings' coach card
  return Promise.all([
    getWorkoutsByUser(userId),
    getAttendanceDatesByMonth({ userId, year: now.getFullYear(), month: now.getMonth() }),
  ]).then(ignore, ignore);
}

/** Waits for `work`, but never longer than `maxMs`. */
export function waitAtMost(work: Promise<unknown>, maxMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, maxMs);
    work.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
