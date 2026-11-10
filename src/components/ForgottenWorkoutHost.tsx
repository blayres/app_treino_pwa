import React, { useEffect, useState } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../i18n';
import { isForgottenSession } from '../services/sessionService';
import { clearSessionChecklist, persistSessionEnd } from '../services/sessionFinisher';
import { getWorkoutTitle } from '../services/workoutService';
import { forgottenSessionTexts } from '../utils/forgottenSession';

/**
 * Asks to finish a workout left open for hours (e.g. started yesterday and
 * never finished). Finishing checks the day it started. Uses the session
 * already restored at boot: no extra query except the workout's title.
 */
export function ForgottenWorkoutHost({ enabled }: { enabled: boolean }) {
  const activeSession = useAppStore((s) => s.activeSession);
  const currentUser = useAppStore((s) => s.currentUser);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const { t, locale } = useI18n();

  const [now, setNow] = useState(() => Date.now());
  const [dismissedSessionId, setDismissedSessionId] = useState<number | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [title, setTitle] = useState<{ workoutId: number; value: string } | null>(null);

  // Re-check when the PWA comes back from the background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const session = activeSession?.isRunning ? activeSession : null;
  const forgotten = Boolean(enabled && session && currentUser && isForgottenSession(session.startedAt, now));
  const workoutId = session?.workoutId;

  useEffect(() => {
    if (!forgotten || workoutId == null) return;
    let cancelled = false;
    getWorkoutTitle(workoutId)
      .then((value) => { if (!cancelled) setTitle({ workoutId, value }); })
      .catch(() => { if (!cancelled) setTitle({ workoutId, value: '' }); });
    return () => { cancelled = true; };
  }, [forgotten, workoutId]);

  if (!forgotten || !session || !currentUser) return null;
  if (dismissedSessionId === session.sessionId) return null;
  // Wait for the title (one small query) so the message doesn't change on screen.
  if (title?.workoutId !== session.workoutId) return null;

  const { message, finishLabel } = forgottenSessionTexts({
    t,
    locale,
    startedAt: session.startedAt,
    workoutTitle: title.value,
    now: new Date(now),
  });

  const end = (cancelOnly: boolean) => {
    setConfirmDiscard(false);
    clearSessionChecklist(session.workoutId);
    setActiveSession(null);
    if (!cancelOnly) {
      try { sessionStorage.setItem('workoutCompletedToast', 'true'); } catch { }
    }
    void persistSessionEnd({ userId: currentUser.id, session, cancelOnly }).catch((err) => console.error(err));
  };

  if (confirmDiscard) {
    return (
      <ConfirmModal
        visible
        title={t.discardWorkoutTitle}
        message={t.discardWorkoutMsg}
        confirmLabel={t.discard}
        cancelLabel={t.cancel}
        confirmDanger
        onConfirm={() => end(true)}
        onCancel={() => setConfirmDiscard(false)}
      />
    );
  }

  return (
    <ConfirmModal
      visible
      title={t.forgottenWorkoutTitle}
      message={message}
      confirmLabel={finishLabel}
      cancelLabel={t.discardWorkout}
      onConfirm={() => end(false)}
      onCancel={() => setConfirmDiscard(true)}
      dismissLabel={t.keepTraining}
      onDismiss={() => setDismissedSessionId(session.sessionId)}
    />
  );
}
