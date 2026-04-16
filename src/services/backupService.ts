import { getDb } from '../db';

export async function exportIndexedDbData() {
  const db = await getDb();
  const [users, exercises, workouts, workoutExercises, exerciseLoads, workoutSessions, attendance] =
    await Promise.all([
      db.getAllAsync(`SELECT * FROM users;`),
      db.getAllAsync(`SELECT * FROM exercises;`),
      db.getAllAsync(`SELECT * FROM workouts;`),
      db.getAllAsync(`SELECT * FROM workout_exercises;`),
      db.getAllAsync(`SELECT * FROM exercise_loads;`),
      db.getAllAsync(`SELECT * FROM workout_sessions;`),
      db.getAllAsync(`SELECT * FROM attendance;`),
    ]);

  return {
    generated_at: new Date().toISOString(),
    users,
    exercises,
    workouts,
    workout_exercises: workoutExercises,
    exercise_loads: exerciseLoads,
    workout_sessions: workoutSessions,
    attendance,
  };
}

export async function downloadIndexedDbBackup() {
  if (typeof window === 'undefined') {
    throw new Error('Exportação disponível apenas no app web.');
  }

  const unsafeWindow = window as any;
  const unsafeDocument = unsafeWindow.document as any;
  const unsafeURL = unsafeWindow.URL as any;
  const unsafeBlob = unsafeWindow.Blob as any;

  const payload = await exportIndexedDbData();
  const json = JSON.stringify(payload, null, 2);
  const blob = new unsafeBlob([json], { type: 'application/json' });
  const url = unsafeURL.createObjectURL(blob);
  const anchor = unsafeDocument.createElement('a');
  anchor.href = url;
  anchor.download = `backup-workout-app-${Date.now()}.json`;
  anchor.click();
  unsafeURL.revokeObjectURL(url);
}
