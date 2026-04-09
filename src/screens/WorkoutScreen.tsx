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
import { getDb, ExerciseRow } from '../db';
import { useAppStore } from '../store/useAppStore';
import { Timer } from '../components/Timer';
import { CircularCheckbox } from '../components/CircularCheckbox';
import { ConfirmModal } from '../components/ConfirmModal';

type WorkoutRoute = RouteProp<RootStackParamList, 'Workout'>;

type WorkoutExercise = {
  id: number;
  exercise: ExerciseRow;
};

export default function WorkoutScreen() {
  const route = useRoute<WorkoutRoute>();
  const navigation = useNavigation();
  const { workoutId } = route.params;
  const currentUser = useAppStore(state => state.currentUser);
  const activeSession = useAppStore(state => state.activeSession);
  const setActiveSession = useAppStore(state => state.setActiveSession);

  const [workoutTitle, setWorkoutTitle] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loads, setLoads] = useState<Record<number, { normal: string; progression: string }>>({});
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCancelAction, setIsCancelAction] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isSessionForThisWorkout =
    activeSession && activeSession.workoutId === workoutId && activeSession.isRunning;

  useEffect(() => {
    if (!isSessionForThisWorkout) return;

    const interval = setInterval(() => {
      setCompletedIds(prev => new Set(prev));
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionForThisWorkout]);

  useEffect(() => {
    if (!currentUser) return;

    (async () => {
      const db = await getDb();

      const titleRow = await db.getFirstAsync<{ title: string }>(
        `SELECT title FROM workouts WHERE id = ?;`,
        workoutId,
      );
      if (titleRow) {
        setWorkoutTitle(titleRow.title);
      }

      const exerciseRows = await db.getAllAsync<any>(
        `SELECT we.id as we_id, we.order_index, e.*
         FROM workout_exercises we
         JOIN exercises e ON e.id = we.exercise_id
         WHERE we.workout_id = ?
         ORDER BY we.order_index ASC;`,
        workoutId,
      );
      const items: WorkoutExercise[] = exerciseRows.map((row: any) => {
        const exercise: ExerciseRow = {
          id: row.id,
          name: row.name,
          primary_muscle: row.primary_muscle,
          secondary_muscle: row.secondary_muscle,
          rest_seconds: row.rest_seconds,
          scheme: row.scheme,
        };
        return { id: row.we_id, exercise };
      });
      setExercises(items);

      const loadRows = await db.getAllAsync<{
        exercise_id: number;
        load_kg: number | null;
        progression_kg: number | null;
      }>(
        `SELECT exercise_id, load_kg, progression_kg FROM exercise_loads
         WHERE user_id = ?;`,
        currentUser.id,
      );
      const map: Record<number, { normal: string; progression: string }> = {};
      loadRows.forEach(row => {
        map[row.exercise_id] = {
          normal: row.load_kg != null ? String(row.load_kg) : '',
          progression: row.progression_kg != null ? String(row.progression_kg) : '',
        };
      });
      setLoads(map);
    })();
  }, [workoutId, currentUser]);

  const handleStart = async () => {
    if (!currentUser || isSessionForThisWorkout) return;

    const startedAt = new Date().toISOString();

    const db = await getDb();

    const result = await db.runAsync(
      `INSERT INTO workout_sessions (user_id, workout_id, started_at, completed)
       VALUES (?, ?, ?, 0);`,
      currentUser.id,
      workoutId,
      startedAt,
    );

    setActiveSession({
      sessionId: result.lastInsertRowId!,
      workoutId,
      startedAt,
      isRunning: true,
    });
  };

  const handleStop = async (cancelOnly: boolean) => {
    if (!currentUser || !activeSession) return;

    const endedAt = new Date();
    const durationSeconds = Math.floor(
      (endedAt.getTime() - new Date(activeSession.startedAt).getTime()) / 1000
    );
    const completed = cancelOnly ? 0 : 1;

    const db = await getDb();

    await db.runAsync(
      `UPDATE workout_sessions
   SET ended_at = ?, duration_seconds = ?, completed = ?
   WHERE id = ?;`,
      endedAt.toISOString(),
      durationSeconds,
      completed,
      activeSession.sessionId,
    );

    await db.runAsync(
      `UPDATE workout_sessions
   SET ended_at = ?, duration_seconds = 0, completed = 0
   WHERE user_id = ? AND ended_at IS NULL AND id != ?;`,
      endedAt.toISOString(),
      currentUser.id,
      activeSession.sessionId,
    );

    if (!cancelOnly) {
      const today = endedAt;
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      await db.runAsync(
        `INSERT OR IGNORE INTO attendance (user_id, date) VALUES (?, ?);`,
        currentUser.id,
        dateStr,
      );
    }

    setActiveSession(null);
    navigation.goBack();
  };

  const seconds = isSessionForThisWorkout
    ? Math.floor(
      (Date.now() - new Date(activeSession!.startedAt).getTime()) / 1000
    )
    : 0;

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

    setLoads(prev => {
      const current = prev[exerciseId] || { normal: '', progression: '' };
      const updated = {
        ...prev,
        [exerciseId]: {
          ...current,
          [type]: value,
        },
      };

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
        const now = new Date().toISOString();
        (async () => {
          const db = await getDb();
          await db.runAsync(
            `INSERT INTO exercise_loads (user_id, exercise_id, load_kg, progression_kg, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id, exercise_id)
             DO UPDATE SET load_kg = excluded.load_kg, progression_kg = excluded.progression_kg, updated_at = excluded.updated_at;`,
            currentUser.id,
            exerciseId,
            normalValue,
            progressionValue,
            now,
          );
        })();
      }

      return updated;
    });
  };

  const handleInputFocus = (index: number) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }, 100);
  };

  const toggleCompleted = (exerciseId: number) => {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
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
            <Text style={styles.backLabel}>Voltar</Text>
          </Pressable>
          <Text style={styles.title}>{workoutTitle}</Text>
        </View>

        <View style={styles.timerRow}>
          <Timer seconds={seconds} />
          <View style={styles.actions}>
            {!isSessionForThisWorkout ? (
              <Pressable
                style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPrimaryPressed]}
                onPress={handleStart}
              >
                <Text style={styles.buttonPrimaryLabel}>Iniciar treino</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.buttonSecondary,
                    pressed && styles.buttonSecondaryPressed,
                  ]}
                  onPress={() => handleStopWithConfirm(true)}
                >
                  <Text style={styles.buttonSecondaryLabel}>Parar (erro)</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPrimaryPressed]}
                  onPress={() => handleStopWithConfirm(false)}
                >
                  <Text style={styles.buttonPrimaryLabel}>Finalizar</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          contentContainerStyle={styles.listContent}
          data={exercises}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          onScrollToIndexFailed={info => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
          renderItem={({ item, index }) => {
            const scheme = item.exercise.scheme;
            const [mainScheme, progression] = scheme.split(' e ');
            const currentLoads = loads[item.exercise.id] || { normal: '', progression: '' };
            const isCompleted = completedIds.has(item.exercise.id);

            return (
              <Pressable
                style={[
                  styles.exerciseRow,
                  isCompleted && styles.exerciseRowActive,
                ]}
                onPress={() => isSessionForThisWorkout ? toggleCompleted(item.exercise.id) : null} // ✅ task 3
              >
                {isSessionForThisWorkout ? (
                  <CircularCheckbox
                    checked={isCompleted}
                    onToggle={() => toggleCompleted(item.exercise.id)}
                  />
                ) : (
                  <View style={styles.checkboxPlaceholder} />
                )}

                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{item.exercise.name}</Text>
                  <Text style={styles.scheme}>
                    {mainScheme}
                    {progression ? ` · ${progression}` : ''}
                  </Text>
                  <Text style={styles.rest}>
                    Intervalo {item.exercise.rest_seconds / 60} min
                  </Text>
                </View>

                <View
                  style={styles.loadColumn}
                  onStartShouldSetResponder={() => true}
                  onTouchEnd={e => e.stopPropagation()}
                >
                  <Text style={styles.loadLabel}>Carga (kg)</Text>
                  <TextInput
                    style={styles.loadInput}
                    keyboardType="decimal-pad"
                    value={currentLoads.normal}
                    onChangeText={text => handleChangeLoad(item.exercise.id, text, 'normal')}
                    onFocus={() => handleInputFocus(index)}
                    placeholder="00"
                  />
                  <Text style={styles.loadLabelProgression}>Progressão</Text>
                  <TextInput
                    style={styles.loadInput}
                    keyboardType="decimal-pad"
                    value={currentLoads.progression}
                    onChangeText={text => handleChangeLoad(item.exercise.id, text, 'progression')}
                    onFocus={() => handleInputFocus(index)}
                    placeholder="00"
                  />
                </View>
              </Pressable>
            );
          }}
        />
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={showConfirmModal}
        title={isCancelAction ? 'Parar treino?' : 'Finalizar treino?'}
        message={
          isCancelAction
            ? 'Tem certeza que deseja parar o treino? Esta ação não será contabilizada como treino concluído.'
            : 'Tem certeza que deseja finalizar o treino? Esta ação será contabilizada como treino concluído.'
        }
        confirmLabel={isCancelAction ? 'Parar' : 'Finalizar'}
        cancelLabel="Cancelar"
        onConfirm={confirmAction}
        onCancel={cancelAction}
        confirmDanger={isCancelAction}
      />
    </SafeAreaView>
  );
}

