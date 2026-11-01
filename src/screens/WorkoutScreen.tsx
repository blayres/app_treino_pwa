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
  invalidateWorkoutsByUserCache,
  getExerciseLoadsByUser,
  getWorkoutExercises,
  getWorkoutTitle,
  upsertExerciseLoad,
  getCachedWorkoutExercises,
  getCachedExerciseLoads,
} from '../services/workoutService';
import { markAttendance, invalidateAttendanceCache } from '../services/attendanceService';
import { startWorkoutSession, stopWorkoutSession } from '../services/sessionService';
import type { Exercise } from '../services/types';
import { Skeleton } from '../components/Skeleton';
import { ExerciseRow, type LoadField } from '../components/ExerciseRow';
import { useI18n } from '../i18n';
import { LogoBar } from '../components/LogoBar';
import { formatDecimal, parseDecimal, sanitizeDecimalInput } from '../utils/decimal';

const STALE_THRESHOLD_SECONDS = 2 * 60 * 60; // 2 hours

type WorkoutRoute = RouteProp<RootStackParamList, 'Workout'>;

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
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loads, setLoads] = useState<Record<number, { normal: string; progression: string }>>({});
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
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

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

  const isSessionForThisWorkout =
    activeSession && activeSession.workoutId === workoutId && activeSession.isRunning;

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    const applyLoads = (loadRows: Awaited<ReturnType<typeof getExerciseLoadsByUser>>) => {
      const map: Record<number, { normal: string; progression: string }> = {};

      loadRows.forEach(row => {
        map[row.exercise_id] = {
          normal: row.load_kg != null ? formatDecimal(Number(row.load_kg), locale) : '',
          progression: row.progression_kg != null ? formatDecimal(Number(row.progression_kg), locale) : '',
        };
      });

      setLoads(map);
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
  }, [workoutId, currentUser]);

  const handleStart = async () => {
    if (!currentUser || isSessionForThisWorkout) return;
    const session = await startWorkoutSession(currentUser.id, workoutId);
    try {
      localStorage.removeItem(`completedIds:${workoutId}`);
      sessionStorage.removeItem(`completedIds:${workoutId}`);
    } catch { }
    setCompletedIds(new Set());
    setActiveSession(session);
  };

  const handleStop = (cancelOnly: boolean) => {
    if (!currentUser || !activeSession) return;
    const sessionToStop = activeSession;
    const userId = currentUser.id;

    // Clear local UI state immediately so the screen feels responsive.
    try {
      localStorage.removeItem(`completedIds:${workoutId}`);
      sessionStorage.removeItem(`completedIds:${workoutId}`);
    } catch { }
    setActiveSession(null);

    // Return to Home immediately. Persistence continues in the background,
    // and Home refreshes when the write has completed.
    if (!cancelOnly) {
      try {
        sessionStorage.setItem('workoutCompletedToast', 'true');
      } catch { }
    }
    navigation.goBack();

    void (async () => {
      try {
        const result = await stopWorkoutSession({
          userId,
          sessionId: sessionToStop.sessionId,
          startedAt: sessionToStop.startedAt,
          cancelOnly,
        });

        if (result.completed) {
          await markAttendance(userId, result.endedAt);
        }

        invalidateAttendanceCache(userId);
        invalidateWorkoutsByUserCache(userId);
        document.dispatchEvent(new Event('workoutSessionUpdated'));
      } catch (err) {
        console.error(err);
      }
    })();
  };

  // Stale detection — recheck when user returns from background
  const [isStale, setIsStale] = useState(() => {
    if (!activeSession || activeSession.workoutId !== workoutId) return false;
    return (Date.now() - new Date(activeSession.startedAt).getTime()) / 1000 > STALE_THRESHOLD_SECONDS;
  });

  useEffect(() => {
    const check = () => {
      if (!isSessionForThisWorkout) { setIsStale(false); return; }
      const elapsed = (Date.now() - new Date(activeSession!.startedAt).getTime()) / 1000;
      setIsStale(elapsed > STALE_THRESHOLD_SECONDS);
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [isSessionForThisWorkout, activeSession]);

  // Human-readable elapsed for stale banner
  const staleElapsed = isSessionForThisWorkout
    ? Math.floor((Date.now() - new Date(activeSession!.startedAt).getTime()) / 1000)
    : 0;
  const staleHours = Math.floor(staleElapsed / 3600);
  const staleMinutes = Math.floor((staleElapsed % 3600) / 60);
  const staleLabel = staleHours > 0
    ? `${staleHours}h ${staleMinutes}min`
    : `${staleMinutes}min`;

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

    if (field === 'normal') pendingHistoryRef.current.add(exerciseId);
    clearTimeout(saveTimersRef.current[exerciseId]);
    saveTimersRef.current[exerciseId] = setTimeout(() => saveLoads(exerciseId, false), 700);
  }, [saveLoads]);

  const scrollToRow = useCallback((index: number) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }, 100);
  }, []);

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
          <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
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
              capSeconds={STALE_THRESHOLD_SECONDS}
            />
          ) : (
            <LiveTimer startedAt={new Date().toISOString()} capSeconds={0} />
          )}

          {isStale ? (
            // ── Stale session banner ──────────────────────────────────────
            <View style={styles.staleBanner}>
              <Text style={styles.staleText}>
                {t.staleBannerText(staleLabel)}
              </Text>
              <View style={styles.staleActions}>
                <Pressable
                  style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonSecondaryPressed]}
                  onPress={() => handleStopWithConfirm(true)}
                >
                  <Text style={styles.buttonSecondaryLabel}>{t.cancelWorkout}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPrimaryPressed]}
                  onPress={() => handleStopWithConfirm(false)}
                >
                  <Text style={styles.buttonPrimaryLabel}>{t.finish}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // ── Normal controls ───────────────────────────────────────────
            <View style={styles.actions}>
              {!isSessionForThisWorkout ? (
                <Pressable
                  style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPrimaryPressed]}
                  onPress={handleStart}
                >
                  <Text style={styles.buttonPrimaryLabel}>{t.startWorkout}</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonSecondaryPressed]}
                    onPress={() => handleStopWithConfirm(true)}
                  >
                    <Text style={styles.buttonSecondaryLabel}>{t.discardWorkout}</Text>
                  </Pressable>
                  <Pressable
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
          <View style={{ paddingHorizontal: 12 }}>
            {[...Array(5)].map((_, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 35,
                  marginTop: 30,
                }}
              >
                <Skeleton width={22} height={22} />

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Skeleton width="70%" height={14} />
                  <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
                  <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
                </View>

                <View style={{ marginLeft: 12 }}>
                  <Skeleton width={60} height={32} style={{ marginBottom: 6 }} />
                  <Skeleton width={60} height={32} />
                </View>
              </View>
            ))}
          </View>
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
                />
              );
            }}
          />
        )}
      </KeyboardAvoidingView>

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
