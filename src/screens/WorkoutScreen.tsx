import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './WorkoutScreen.styles';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../../App';
import { useAppStore } from '../store/useAppStore';
import { LiveTimer } from '../components/LiveTimer';
import { CircularCheckbox } from '../components/CircularCheckbox';
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
import { markAttendance } from '../services/attendanceService';
import { startWorkoutSession, stopWorkoutSession } from '../services/sessionService';
import type { Exercise } from '../services/types';
import { Skeleton } from '../components/Skeleton';
import { ExerciseLibraryCard } from '../components/ExerciseLibraryCard';
import { useI18n } from '../i18n';

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
  const activeWorkout = useAppStore(state => state.activeWorkout);
  const setActiveSession = useAppStore(state => state.setActiveSession);
  const setActiveWorkoutTitle = useAppStore(state => state.setActiveWorkoutTitle);
  const setActiveWorkoutLoad = useAppStore(state => state.setActiveWorkoutLoad);
  const setActiveWorkoutLoads = useAppStore(state => state.setActiveWorkoutLoads);
  const toggleCompletedExercise = useAppStore(state => state.toggleCompletedExercise);
  const clearActiveWorkout = useAppStore(state => state.clearActiveWorkout);
  const setActiveWorkoutScreen = useAppStore(state => state.setActiveWorkoutScreen);
  const beginActiveWorkout = useAppStore(state => state.beginActiveWorkout);
  const { t } = useI18n();

  const [focusedLoadInput, setFocusedLoadInput] = useState<string | null>(null);
  const routeTitle = route.params?.workoutTitle;
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCancelAction, setIsCancelAction] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const exerciseToRestoreRef = useRef(activeWorkout?.currentExerciseId ?? null);

  useEffect(() => {
    if (!currentUser) return;

    setActiveWorkoutScreen('Workout');

    if (
      activeWorkout?.userId !== currentUser.id
      || activeWorkout.workoutId !== workoutId
    ) {
      beginActiveWorkout({
        userId: currentUser.id,
        workoutId,
        workoutTitle: routeTitle ?? null,
      });
    } else if (
      routeTitle != null
      && activeWorkout.workoutTitle !== routeTitle
    ) {
      setActiveWorkoutTitle(routeTitle);
    }
  }, [
    activeWorkout?.userId,
    activeWorkout?.workoutId,
    activeWorkout?.workoutTitle,
    beginActiveWorkout,
    currentUser,
    routeTitle,
    setActiveWorkoutScreen,
    setActiveWorkoutTitle,
    workoutId,
  ]);

  useEffect(
    () => navigation.addListener('beforeRemove', () => {
      setActiveWorkoutScreen('Home');
    }),
    [navigation, setActiveWorkoutScreen],
  );

  useEffect(() => {
    const exerciseId = exerciseToRestoreRef.current;
    if (exerciseId == null || exercises.length === 0) return;

    const index = exercises.findIndex(item => item.exercise.id === exerciseId);
    exerciseToRestoreRef.current = null;
    if (index < 0) return;

    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }, 0);

    return () => clearTimeout(timeout);
  }, [exercises]);

  const isSessionForThisWorkout =
    activeSession && activeSession.workoutId === workoutId && activeSession.isRunning;

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    const applyLoads = (loadRows: Awaited<ReturnType<typeof getExerciseLoadsByUser>>) => {
      const map: Record<number, { normal: string; progression: string }> = {};

      loadRows.forEach(row => {
        map[row.exercise_id] = {
          normal: row.load_kg != null ? String(row.load_kg) : '',
          progression: row.progression_kg != null ? String(row.progression_kg) : '',
        };
      });

      setActiveWorkoutLoads(map);
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

        setActiveWorkoutTitle(title);

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
    beginActiveWorkout({
      userId: currentUser.id,
      workoutId,
      workoutTitle: activeWorkout?.workoutTitle ?? routeTitle ?? null,
    });
    const session = await startWorkoutSession(currentUser.id, workoutId);
    setActiveSession(session);
  };

  const handleStop = async (cancelOnly: boolean) => {
    if (!currentUser || !activeSession) return;

    const result = await stopWorkoutSession({
      userId: currentUser.id,
      sessionId: activeSession.sessionId,
      startedAt: activeSession.startedAt,
      cancelOnly,
    });

    if (result.completed) {
      await markAttendance(currentUser.id, result.endedAt);
      invalidateWorkoutsByUserCache(currentUser.id);
    }

    clearActiveWorkout();
    setActiveSession(null);
    navigation.goBack();
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

  const handleChangeLoad = (
    exerciseId: number,
    value: string,
    type: 'normal' | 'progression',
  ) => {
    if (!currentUser) return;

    const current = (activeWorkout?.loads?.[exerciseId] || { normal: '', progression: '' });
    const updated = {
      ...activeWorkout?.loads,
      [exerciseId]: {
        ...current,
        [type]: value,
      },
    };

    setActiveWorkoutLoad(exerciseId, {
      ...current,
      [type]: value,
    });

    // Save to database
    const numeric = Number(value.replace(',', '.'));
    const normalValue =
      type === 'normal'
        ? numeric || null
        : Number(updated[exerciseId].normal.replace(',', '.')) || null;
    const progressionValue =
      type === 'progression'
        ? numeric || null
        : Number(updated[exerciseId].progression.replace(',', '.')) || null;

    if (!Number.isNaN(numeric) || value === '') {
      (async () => {
        await upsertExerciseLoad({
          userId: currentUser.id,
          exerciseId,
          loadKg: normalValue,
          progressionKg: progressionValue,
        });
      })();
    }
  };

  const handleInputFocus = (index: number) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }, 100);
  };

  const toggleCompleted = (exerciseId: number) => {
    toggleCompletedExercise(exerciseId);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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
            {(activeWorkout?.workoutTitle ?? routeTitle ?? '') || <Skeleton width={250} height={22} />}
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
                    <Text style={styles.buttonSecondaryLabel}>{t.stopError}</Text>
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
              const scheme = item.exercise.scheme;
              const [mainScheme, progression] = scheme.split(' e ');
              const currentLoads =
                activeWorkout?.loads?.[item.exercise.id] || { normal: '', progression: '' };
              const isCompleted = (activeWorkout?.completedExerciseIds ?? []).includes(item.exercise.id);

              const restSecs = item.exercise.rest_seconds;
              const restMin = Math.floor(restSecs / 60);
              const restRemSec = restSecs % 60;
              const restLabel = restMin > 0 && restRemSec > 0
                ? `${restMin}${t.minuteShort} ${restRemSec}${t.secondShort}`
                : restMin > 0
                  ? `${restMin}${t.minuteShort}`
                  : `${restRemSec}${t.secondShort}`;

              return (
                <Pressable
                  style={[
                    styles.exerciseRow,
                    isCompleted && styles.exerciseRowActive,
                  ]}
                >
                  {isSessionForThisWorkout ? (
                    <CircularCheckbox
                      checked={isCompleted}
                      onToggle={() => toggleCompleted(item.exercise.id)}
                    />
                  ) : (
                    <View style={styles.checkboxPlaceholder} />
                  )}

                  <Pressable
                    style={styles.exerciseInfo}
                    onPress={() =>
                      isSessionForThisWorkout
                        ? toggleCompleted(item.exercise.id)
                        : null
                    }
                  >
                    <Text style={styles.exerciseName}>
                      {item.exercise.name}
                    </Text>

                    {!isCompleted ? (
                      <>
                        <Text style={styles.scheme}>
                          {mainScheme}
                          {progression ? ` · ${progression}` : ''}
                        </Text>

                        <Text style={styles.rest}>
                          {t.restInterval(restLabel)}
                        </Text>

                        {item.exercise.tip ? (
                          <Text style={styles.tip}>{item.exercise.tip}</Text>
                        ) : null}

                        {item.exercise.library ? (
                          <ExerciseLibraryCard library={item.exercise.library} />
                        ) : null}
                      </>
                    ) : null}
                  </Pressable>

                  {!isCompleted ? (
                    <View style={styles.loadColumn}>
                      <Text style={styles.loadLabel}>{t.loadKg}</Text>
                      <TextInput
                        style={styles.loadInput}
                        keyboardType="decimal-pad"
                        value={currentLoads.normal}
                        onChangeText={text =>
                          handleChangeLoad(item.exercise.id, text, 'normal')
                        }
                        onFocus={() => {
                          setFocusedLoadInput(`${item.exercise.id}-normal`);
                          handleInputFocus(index);
                        }}
                        onBlur={() => setFocusedLoadInput(null)}
                        placeholder={
                          focusedLoadInput === `${item.exercise.id}-normal` ? '' : t.loadPlaceholder
                        }
                      />

                    <Text style={styles.loadLabelProgression}>{t.progression}</Text>

                      <TextInput
                        style={styles.loadInput}
                        keyboardType="decimal-pad"
                        value={currentLoads.progression}
                        onChangeText={text =>
                          handleChangeLoad(item.exercise.id, text, 'progression')
                        }
                        onFocus={() => {
                          setFocusedLoadInput(`${item.exercise.id}-progression`);
                          handleInputFocus(index);
                        }}
                        onBlur={() => setFocusedLoadInput(null)}
                        placeholder={
                          focusedLoadInput === `${item.exercise.id}-progression` ? '' : t.loadPlaceholder
                        }
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={showConfirmModal}
        title={isCancelAction ? t.stopWorkoutTitle : t.finishWorkoutTitle}
        message={isCancelAction ? t.stopWorkoutMsg : t.finishWorkoutMsg}
        confirmLabel={isCancelAction ? t.stop : t.finish}
        cancelLabel={t.cancel}
        onConfirm={confirmAction}
        onCancel={cancelAction}
        confirmDanger={isCancelAction}
      />
    </SafeAreaView>
  );
}
