import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './WorkoutScreen.styles';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { LiveTimer } from '../components/LiveTimer';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  getExerciseLoadsByUser,
  getWorkoutExercises,
  getWorkoutTitle,
  upsertExerciseLoad,
  getCachedWorkoutExercises,
  getCachedExerciseLoads,
} from '../services/workoutService';
import { FORGOTTEN_SESSION_SECONDS, isForgottenSession, startWorkoutSession } from '../services/sessionService';
import { clearSessionChecklist, persistSessionEnd } from '../services/sessionFinisher';
import { forgottenSessionTexts } from '../utils/forgottenSession';
import type { Exercise, ExerciseLoad } from '../services/types';
import type { Locale } from '../i18n';
import { Skeleton } from '../components/Skeleton';
import { WorkoutExercisesSkeleton } from '../components/WorkoutExercisesSkeleton';
import { ExerciseRow, type LoadField } from '../components/ExerciseRow';
import { timedExerciseIds } from '../utils/measure';
import { SubstitutesSheet } from '../components/SubstitutesSheet';
import { useI18n } from '../i18n';
import { LogoBar } from '../components/LogoBar';
import { formatDecimal, parseDecimal, sanitizeDecimalInput } from '../utils/decimal';
import { useTourStore, useTourTarget } from '../store/useTourStore';
import { useExerciseVideos } from '../hooks/useExerciseVideos';

type WorkoutRoute = RouteProp<RootStackParamList, 'Workout'>;

type LoadInputs = Record<number, { normal: string; progression: string }>;

/** Saved loads → text shown in the inputs (decimal separator of the language). */
function loadsToInputs(rows: ExerciseLoad[], locale: Locale): LoadInputs {
  const map: LoadInputs = {};
  rows.forEach(row => {
    map[row.exercise_id] = {
      normal: row.load_kg != null ? formatDecimal(Number(row.load_kg), locale) : '',
      progression: row.progression_kg != null ? formatDecimal(Number(row.progression_kg), locale) : '',
    };
  });
  return map;
}

type WorkoutExercise = {
  id: number;
  exercise: Exercise;
};

export default function WorkoutScreen() {
  const route = useRoute<WorkoutRoute>();
  const navigation = useNavigation();
  const { workoutId } = route.params;
  const currentUser = useAppStore(state => state.currentUser);
  const activeSession = useAppStore(state => state.activeSession);
  const setActiveSession = useAppStore(state => state.setActiveSession);
  const { t, locale } = useI18n();

  const routeTitle = route.params?.workoutTitle;
  const [workoutTitle, setWorkoutTitle] = useState(routeTitle ?? '');
  // Cached data (warmed from Home) is drawn on the first frame; fresh data follows.
  const [exercises, setExercises] = useState<WorkoutExercise[]>(() =>
    (getCachedWorkoutExercises(workoutId) ?? []).map(row => ({ id: row.id, exercise: row.exercise })),
  );
  const [loads, setLoads] = useState<Record<number, { normal: string; progression: string }>>(() =>
    currentUser ? loadsToInputs(getCachedExerciseLoads(currentUser.id) ?? [], locale) : {},
  );
  const [completedIds, setCompletedIds] = useState<Set<number>>(() => {
    // localStorage survives iOS discarding the PWA's web process while it is
    // backgrounded. sessionStorage is used only as a one-time fallback for
    // checkmarks stored by older versions of the app.
    try {
      const key = `completedIds:${workoutId}`;
      const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
      if (raw) return new Set<number>(JSON.parse(raw));
    } catch { }
    return new Set<number>();
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCancelAction, setIsCancelAction] = useState(false);
  const [isLoading, setIsLoading] = useState(() => getCachedWorkoutExercises(workoutId) === null);
  const flatListRef = useRef<FlatList>(null);
  const startTourRef = useTourTarget('workout.start');
  const videos = useExerciseVideos(currentUser?.id);
  const toursLoaded = useTourStore((s) => s.seen !== null);
  const startTourIfNew = useTourStore((s) => s.startIfNew);

  // Keep durable storage in sync whenever completedIds changes.
  useEffect(() => {
    try {
      const key = `completedIds:${workoutId}`;
      localStorage.setItem(key, JSON.stringify([...completedIds]));
    } catch { }
  }, [completedIds, workoutId]);

  // Re-read the durable checklist when the user returns to the tab.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const key = `completedIds:${workoutId}`;
        const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
        if (raw) {
          const restored = new Set<number>(JSON.parse(raw));
          setCompletedIds(restored);
        }
      } catch { }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [workoutId]);

  // New users: tips on the first workout opened (start, load, substitutes).
  const hasExercises = !isLoading && exercises.length > 0;
  useEffect(() => {
    if (!toursLoaded || !hasExercises) return;
    const timer = setTimeout(() => startTourIfNew('workout'), 600);
    return () => clearTimeout(timer);
  }, [toursLoaded, hasExercises, startTourIfNew]);

  const isSessionForThisWorkout =
    activeSession && activeSession.workoutId === workoutId && activeSession.isRunning;

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    const applyLoads = (loadRows: Awaited<ReturnType<typeof getExerciseLoadsByUser>>) => {
      setLoads(loadsToInputs(loadRows, locale));
    };

    const cachedExercises = getCachedWorkoutExercises(workoutId);
    const cachedLoads = getCachedExerciseLoads(currentUser.id);

    if (cachedExercises) {
      setExercises(
        cachedExercises.map(row => ({
          id: row.id,
          exercise: row.exercise,
        })),
      );
    }

    if (cachedLoads) {
      applyLoads(cachedLoads);
    }

    const hasCachedContent = Boolean(cachedExercises);

    if (!hasCachedContent) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }

    (async () => {
      try {
        const [title, workoutExercises, loadRows] = await Promise.all([
          getWorkoutTitle(workoutId),
          getWorkoutExercises(workoutId),
          getExerciseLoadsByUser(currentUser.id),
        ]);

        if (cancelled) return;

        setWorkoutTitle(title);

        setExercises(
          workoutExercises.map(row => ({
            id: row.id,
            exercise: row.exercise,
          })),
        );

        applyLoads(loadRows);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workoutId, currentUser, locale]);

  const handleStart = async () => {
    if (!currentUser || isSessionForThisWorkout) return;
    const session = await startWorkoutSession(currentUser.id, workoutId);
    clearSessionChecklist(workoutId);
    setCompletedIds(new Set());
    setActiveSession(session);
  };

  const handleStop = (cancelOnly: boolean) => {
    if (!currentUser || !activeSession) return;
    const sessionToStop = activeSession;
    const userId = currentUser.id;

    // Clear local UI state immediately so the screen feels responsive.
    clearSessionChecklist(workoutId);
    setActiveSession(null);

    // Return to Home immediately. Persistence continues in the background,
    // and Home refreshes when the write has completed.
    if (!cancelOnly) {
      try {
        sessionStorage.setItem('workoutCompletedToast', 'true');
      } catch { }
    }
    navigation.goBack();

    void persistSessionEnd({ userId, session: sessionToStop, cancelOnly }).catch(err => console.error(err));
  };

  // Stale detection — recheck when user returns from background
  const [isStale, setIsStale] = useState(() => {
    if (!activeSession || activeSession.workoutId !== workoutId) return false;
    return isForgottenSession(activeSession.startedAt);
  });

  useEffect(() => {
    const check = () => {
      if (!isSessionForThisWorkout) { setIsStale(false); return; }
      setIsStale(isForgottenSession(activeSession!.startedAt));
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [isSessionForThisWorkout, activeSession]);

  // Same texts as ForgottenWorkoutHost: when it started and which day gets the check.
  const staleTexts = isStale && isSessionForThisWorkout
    ? forgottenSessionTexts({ t, locale, startedAt: activeSession!.startedAt, workoutTitle })
    : null;

  const handleStopWithConfirm = (cancelOnly: boolean) => {
    setIsCancelAction(cancelOnly);
    setShowConfirmModal(true);
  };

  const confirmAction = () => {
    handleStop(isCancelAction);
    setShowConfirmModal(false);
  };

  const cancelAction = () => {
    setShowConfirmModal(false);
  };

  // Latest typed loads, readable from timers/handlers without stale closures.
  const loadsRef = useRef(loads);
  loadsRef.current = loads;
  // Per-exercise debounce of the "current load" save, and exercises whose final
  // value still has to go to the progress history (recorded on blur only, so
  // intermediate keystrokes like 4 → 43 → 43,5 never become history entries).
  const saveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const timedIdsRef = useRef<Set<number>>(new Set());
  timedIdsRef.current = timedExerciseIds(exercises);
  const pendingHistoryRef = useRef<Set<number>>(new Set());

  // Handlers passed to the memoised ExerciseRow must be stable (useCallback +
  // refs), otherwise every keystroke would re-render every row.
  const userIdRef = useRef(currentUser?.id);
  userIdRef.current = currentUser?.id;
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const saveLoads = useCallback((exerciseId: number, recordHistory: boolean) => {
    const userId = userIdRef.current;
    if (!userId) return;
    clearTimeout(saveTimersRef.current[exerciseId]);
    delete saveTimersRef.current[exerciseId];
    const current = loadsRef.current[exerciseId] || { normal: '', progression: '' };
    void upsertExerciseLoad({
      userId,
      exerciseId,
      loadKg: parseDecimal(current.normal) || null,
      progressionKg: parseDecimal(current.progression) || null,
      recordHistory,
    }).catch(err => console.warn('Falha ao salvar carga:', err));
  }, []);

  const flushLoad = useCallback((exerciseId: number) => {
    const recordHistory = pendingHistoryRef.current.has(exerciseId);
    if (!recordHistory && !saveTimersRef.current[exerciseId]) return;
    pendingHistoryRef.current.delete(exerciseId);
    saveLoads(exerciseId, recordHistory);
  }, [saveLoads]);

  // Leaving the screen saves anything still pending.
  useEffect(() => () => {
    const ids = new Set([
      ...Object.keys(saveTimersRef.current).map(Number),
      ...pendingHistoryRef.current,
    ]);
    ids.forEach(id => flushLoad(id));
  }, [flushLoad]);

  const handleChangeLoad = useCallback((exerciseId: number, text: string, field: LoadField) => {
    if (!userIdRef.current) return;
    const value = sanitizeDecimalInput(text, localeRef.current);

    setLoads(prev => {
      const current = prev[exerciseId] || { normal: '', progression: '' };
      const next = { ...prev, [exerciseId]: { ...current, [field]: value } };
      loadsRef.current = next;
      return next;
    });

    // Timed exercises (plank…) keep their hold time but stay out of the load history.
    if (field === 'normal' && !timedIdsRef.current.has(exerciseId)) pendingHistoryRef.current.add(exerciseId);
    clearTimeout(saveTimersRef.current[exerciseId]);
    saveTimersRef.current[exerciseId] = setTimeout(() => saveLoads(exerciseId, false), 700);
  }, [saveLoads]);

  const scrollToRow = useCallback((index: number) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }, 100);
  }, []);

  // Exercise whose substitutes are shown (null = sheet closed).
  const [substitutesFor, setSubstitutesFor] = useState<Exercise | null>(null);

  const toggleCompleted = useCallback((exerciseId: number) => {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <LogoBar />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} hitSlop={16}>
            <Text style={styles.backLabel}>{t.back}</Text>
          </Pressable>

          <Text style={styles.title}>
            {workoutTitle || <Skeleton width={250} height={22} />}
          </Text>
        </View>

        <View style={styles.timerRow}>
          {isSessionForThisWorkout ? (
            <LiveTimer
              startedAt={activeSession!.startedAt}
              capSeconds={FORGOTTEN_SESSION_SECONDS}
            />
          ) : (
            <LiveTimer startedAt={new Date().toISOString()} capSeconds={0} />
          )}

          {isStale ? (
            // ── Stale session banner ──────────────────────────────────────
            <View style={styles.staleBanner}>
              <Text style={styles.staleText}>
                {t.forgottenWorkoutTitle} {staleTexts?.message}
              </Text>
              <View style={styles.staleActions}>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonSecondaryPressed]}
                  onPress={() => handleStopWithConfirm(true)}
                >
                  <Text style={styles.buttonSecondaryLabel}>{t.discardWorkout}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPrimaryPressed]}
                  onPress={() => handleStopWithConfirm(false)}
                >
                  <Text style={styles.buttonPrimaryLabel}>{staleTexts?.finishLabel ?? t.finish}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // ── Normal controls ───────────────────────────────────────────
            <View style={styles.actions}>
              {!isSessionForThisWorkout ? (
                <Pressable
                  accessibilityRole="button"
                  ref={startTourRef}
                  style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPrimaryPressed]}
                  onPress={handleStart}
                >
                  <Text style={styles.buttonPrimaryLabel}>{t.startWorkout}</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonSecondaryPressed]}
                    onPress={() => handleStopWithConfirm(true)}
                  >
                    <Text style={styles.buttonSecondaryLabel}>{t.discardWorkout}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPrimaryPressed]}
                    onPress={() => handleStopWithConfirm(false)}
                  >
                    <Text style={styles.buttonPrimaryLabel}>{t.finish}</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>

        {isLoading ? (
          <WorkoutExercisesSkeleton />
        ) : (
          <FlatList
            ref={flatListRef}
            contentContainerStyle={styles.listContent}
            data={exercises}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            onScrollToIndexFailed={info => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                });
              }, 500);
            }}
            renderItem={({ item, index }) => {
              const currentLoads = loads[item.exercise.id] || { normal: '', progression: '' };
              return (
                <ExerciseRow
                  exercise={item.exercise}
                  index={index}
                  isSessionActive={Boolean(isSessionForThisWorkout)}
                  isCompleted={completedIds.has(item.exercise.id)}
                  loadNormal={currentLoads.normal}
                  loadProgression={currentLoads.progression}
                  onToggle={toggleCompleted}
                  onChangeLoad={handleChangeLoad}
                  onLoadFocus={scrollToRow}
                  onLoadBlur={flushLoad}
                  onShowSubstitutes={setSubstitutesFor}
                  isTourAnchor={index === 0}
                  video={videos.get(item.exercise.id)}
                />
              );
            }}
          />
        )}
      </KeyboardAvoidingView>

      {currentUser && (
        <SubstitutesSheet exercise={substitutesFor} userId={currentUser.id} onClose={() => setSubstitutesFor(null)} />
      )}

      <ConfirmModal
        visible={showConfirmModal}
        title={isCancelAction ? t.discardWorkoutTitle : t.finishWorkoutTitle}
        message={isCancelAction ? t.discardWorkoutMsg : t.finishWorkoutMsg}
        confirmLabel={isCancelAction ? t.discard : t.finish}
        cancelLabel={t.cancel}
        onConfirm={confirmAction}
        onCancel={cancelAction}
        confirmDanger={isCancelAction}
      />
    </SafeAreaView>
  );
}
