import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { styles } from './AdminScreen.styles';
import { listExercises, getWorkoutsByUser } from '../services/workoutService';
import { listUsers, replaceWorkoutExerciseOrder, saveExercise, saveWorkout } from '../services/adminService';
import { isCurrentUserAdmin } from '../services/authService';
import { getStudentStats, type StudentStats } from '../services/adminStatsService';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';

export default function AdminScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [exerciseForm, setExerciseForm] = useState({
    id: '',
    name: '',
    primary: '',
    secondary: '',
    rest: '90',
    scheme: '3x10-12',
    tip: '',
  });
  const [workoutForm, setWorkoutForm] = useState({
    id: '',
    title: '',
    day: '1',
    exerciseIds: '',
  });

  const selectedUserName = useMemo(
    () => users.find((user) => user.id === selectedUserId)?.name ?? t.selectStudent,
    [users, selectedUserId, t.selectStudent],
  );

  const dayOptions = useMemo(
    () => [1, 2, 3, 4, 5, 6, 7].map((value) => ({
      value,
      label: t.dayLabels[value],
    })),
    [t.dayLabels],
  );

  const loadStats = useCallback(async (userId: number) => {
    setLoadingStats(true);
    try {
      const data = await getStudentStats(userId);
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    const userRows = await listUsers();
    setUsers(userRows);
    const fallbackUserId = userRows[0]?.id ?? null;
    const activeUserId = selectedUserId ?? fallbackUserId;
    setSelectedUserId(activeUserId);

    if (activeUserId != null) {
      const [workoutRows, exerciseRows] = await Promise.all([
        getWorkoutsByUser(activeUserId),
        listExercises(),
      ]);
      setWorkouts(workoutRows);
      setExercises(exerciseRows);
      await loadStats(activeUserId);
    }
  }, [selectedUserId, loadStats]);

  useEffect(() => {
    (async () => {
      const allowed = await isCurrentUserAdmin();
      setAuthorized(allowed);
      if (!allowed) return;
      await loadData();
    })();
  }, [loadData]);

  const handleSelectUser = async (userId: number) => {
    setSelectedUserId(userId);
    const workoutRows = await getWorkoutsByUser(userId);
    setWorkouts(workoutRows);
    await loadStats(userId);
  };

  const handleSaveExercise = async () => {
    try {
      await saveExercise({
        id: exerciseForm.id ? Number(exerciseForm.id) : undefined,
        name: exerciseForm.name.trim(),
        primary_muscle: exerciseForm.primary.trim() || null,
        secondary_muscle: exerciseForm.secondary.trim() || null,
        rest_seconds: Number(exerciseForm.rest),
        scheme: exerciseForm.scheme.trim(),
        tip: exerciseForm.tip.trim() || null,
        exercise_library_id: null,
      });
      Alert.alert(t.savedSuccess, t.exerciseSaved);
      setExerciseForm({ id: '', name: '', primary: '', secondary: '', rest: '90', scheme: '3x10-12', tip: '' });
      setExercises(await listExercises());
    } catch (error: any) {
      Alert.alert(t.saveError, error?.message ?? t.couldNotSaveExercise);
    }
  };

  const handleSaveWorkout = async () => {
    if (!selectedUserId) return;
    try {
      const workoutId = await saveWorkout({
        id: workoutForm.id ? Number(workoutForm.id) : undefined,
        user_id: selectedUserId,
        title: workoutForm.title.trim(),
        day_of_week: Number(workoutForm.day),
      });
      const parsedExerciseIds = workoutForm.exerciseIds
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
      await replaceWorkoutExerciseOrder(workoutId, parsedExerciseIds);
      Alert.alert(t.savedSuccess, t.workoutSaved);
      setWorkoutForm({ id: '', title: '', day: '1', exerciseIds: '' });
      setWorkouts(await getWorkoutsByUser(selectedUserId));
    } catch (error: any) {
      Alert.alert(t.saveError, error?.message ?? t.couldNotSaveWorkout);
    }
  };

  if (authorized === false) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>{t.accessDenied}</Text>
          <Text style={styles.description}>{t.accessDeniedMsg}</Text>
          <Pressable style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonLabel}>{t.back}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t.adminPanel}</Text>
        <Text style={styles.description}>{t.adminPanelDesc}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.activeStudent}</Text>
          <Text style={styles.helper}>{selectedUserName}</Text>
          <View style={styles.chipRow}>
            {users.map((user) => (
              <Pressable
                key={user.id}
                style={[styles.chip, selectedUserId === user.id && styles.chipActive]}
                onPress={() => handleSelectUser(user.id)}
              >
                <Text style={styles.chipLabel}>{user.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Student dashboard ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.dashboard(selectedUserName)}</Text>

          {loadingStats ? (
            <Text style={styles.emptyText}>{t.loadingData}</Text>
          ) : stats ? (
            <>
              {/* Top stats row */}
              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <View style={[styles.checkinDot, { backgroundColor: stats.checkedInToday ? colors.success : colors.danger }]} />
                  <Text style={styles.statValue}>{stats.checkedInToday ? t.yes : t.no}</Text>
                  <Text style={styles.statLabel}>{t.checkinToday}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{`${stats.weeklyFrequency}${t.timesSuffix}`}</Text>
                  <Text style={styles.statLabel}>{t.workouts7Days}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{stats.lastDurationMinutes > 0 ? `${stats.lastDurationMinutes}` : t.notAvailable}</Text>
                  <Text style={styles.statLabel}>{t.lastWorkoutMin}</Text>
                </View>
              </View>

              {/* Loads table */}
              <Text style={[styles.helper, styles.spaced]}>{t.loadsRegistered}</Text>
              {stats.loads.length === 0 ? (
                <Text style={styles.emptyText}>{t.noLoads}</Text>
              ) : (
                stats.loads.map((row) => (
                  <View key={row.exercise_id} style={styles.loadRow}>
                    <Text style={styles.loadName}>{row.exercise_name}</Text>
                    <Text style={styles.loadValue}>
                      {row.load_kg != null ? `${row.load_kg} ${t.kgUnit}` : t.notAvailable}
                    </Text>
                    {row.progression_kg != null ? (
                      <Text style={styles.loadProgression}>+{row.progression_kg} {t.kgUnit}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>{t.selectStudentToSee}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.exerciseCrud}</Text>
          <TextInput style={styles.input} placeholder={t.idPlaceholder} value={exerciseForm.id} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, id: value }))} />
          <TextInput style={styles.input} placeholder={t.exerciseNamePlaceholder} value={exerciseForm.name} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, name: value }))} />
          <TextInput style={styles.input} placeholder={t.primaryMusclePlaceholder} value={exerciseForm.primary} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, primary: value }))} />
          <TextInput style={styles.input} placeholder={t.secondaryMusclePlaceholder} value={exerciseForm.secondary} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, secondary: value }))} />
          <TextInput style={styles.input} placeholder={t.restPlaceholder} keyboardType="number-pad" value={exerciseForm.rest} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, rest: value }))} />
          <TextInput style={styles.input} placeholder={t.schemePlaceholder} value={exerciseForm.scheme} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, scheme: value }))} />
          <TextInput style={styles.input} placeholder={t.tipPlaceholder} value={exerciseForm.tip} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, tip: value }))} multiline />
          <Pressable style={styles.button} onPress={handleSaveExercise}>
            <Text style={styles.buttonLabel}>{t.saveExercise}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.workoutCrud}</Text>
          <TextInput style={styles.input} placeholder={t.exerciseIdPlaceholder} value={workoutForm.id} onChangeText={(value) => setWorkoutForm((prev) => ({ ...prev, id: value }))} />
          <TextInput style={styles.input} placeholder={t.workoutTitlePlaceholder} value={workoutForm.title} onChangeText={(value) => setWorkoutForm((prev) => ({ ...prev, title: value }))} />
          <TextInput style={styles.input} placeholder={t.weekdayPlaceholder} keyboardType="number-pad" value={workoutForm.day} onChangeText={(value) => setWorkoutForm((prev) => ({ ...prev, day: value }))} />
          <TextInput
            style={styles.input}
            placeholder={t.exerciseIdsPlaceholder}
            value={workoutForm.exerciseIds}
            onChangeText={(value) => setWorkoutForm((prev) => ({ ...prev, exerciseIds: value }))}
          />
          <Pressable style={styles.button} onPress={handleSaveWorkout}>
            <Text style={styles.buttonLabel}>{t.saveWorkout}</Text>
          </Pressable>
          <Text style={styles.helper}>{t.daysRef} {dayOptions.map((day) => `${day.value}=${day.label}`).join(' | ')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.quickRef}</Text>
          <Text style={styles.helper}>{t.currentWorkouts}</Text>
          {workouts.map((workout) => (
            <Text key={workout.id} style={styles.listItem}>
              #{workout.id} · D{workout.day_of_week} · {workout.title}
            </Text>
          ))}
          <Text style={[styles.helper, styles.spaced]}>{t.currentExercises}</Text>
          {exercises.map((exercise) => (
            <Text key={exercise.id} style={styles.listItem}>
              #{exercise.id} · {exercise.name} · {exercise.scheme}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
