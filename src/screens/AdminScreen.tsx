import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { styles } from './AdminScreen.styles';
import { listExercises, getWorkoutsByUser } from '../services/workoutService';
import { listUsers, replaceWorkoutExerciseOrder, saveExercise, saveWorkout } from '../services/adminService';
import { isCurrentUserAdmin } from '../services/authService';

const dayOptions = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

export default function AdminScreen() {
  const navigation = useNavigation();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);

  const [exerciseForm, setExerciseForm] = useState({
    id: '',
    name: '',
    primary: '',
    secondary: '',
    rest: '90',
    scheme: '3x10-12',
    hint: '',
  });
  const [workoutForm, setWorkoutForm] = useState({
    id: '',
    title: '',
    day: '1',
    exerciseIds: '',
  });

  const selectedUserName = useMemo(
    () => users.find((user) => user.id === selectedUserId)?.name ?? 'Selecione a aluna',
    [users, selectedUserId],
  );

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
    }
  }, [selectedUserId]);

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
        hint: exerciseForm.hint.trim() || null,
      });
      Alert.alert('Sucesso', 'Exercício salvo.');
      setExerciseForm({ id: '', name: '', primary: '', secondary: '', rest: '90', scheme: '3x10-12', hint: '' });
      setExercises(await listExercises());
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível salvar exercício.');
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
      Alert.alert('Sucesso', 'Treino salvo.');
      setWorkoutForm({ id: '', title: '', day: '1', exerciseIds: '' });
      setWorkouts(await getWorkoutsByUser(selectedUserId));
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível salvar treino.');
    }
  };

  if (authorized === false) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Acesso negado</Text>
          <Text style={styles.description}>Sua conta não tem permissão de admin.</Text>
          <Pressable style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonLabel}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Painel Admin</Text>
        <Text style={styles.description}>Crie e edite treinos/exercícios sem mexer no app da aluna.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aluna ativa</Text>
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>CRUD de exercícios</Text>
          <TextInput style={styles.input} placeholder="ID (deixe vazio para criar)" value={exerciseForm.id} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, id: value }))} />
          <TextInput style={styles.input} placeholder="Nome" value={exerciseForm.name} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, name: value }))} />
          <TextInput style={styles.input} placeholder="Músculo primário" value={exerciseForm.primary} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, primary: value }))} />
          <TextInput style={styles.input} placeholder="Músculo secundário" value={exerciseForm.secondary} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, secondary: value }))} />
          <TextInput style={styles.input} placeholder="Descanso (segundos)" keyboardType="number-pad" value={exerciseForm.rest} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, rest: value }))} />
          <TextInput style={styles.input} placeholder="Série (ex: 4x8-10)" value={exerciseForm.scheme} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, scheme: value }))} />
          <TextInput style={styles.input} placeholder="Comentário (ex: joelhos alinhados com os pés)" value={exerciseForm.hint} onChangeText={(value) => setExerciseForm((prev) => ({ ...prev, hint: value }))} multiline />
          <Pressable style={styles.button} onPress={handleSaveExercise}>
            <Text style={styles.buttonLabel}>Salvar exercício</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>CRUD de treinos</Text>
          <TextInput style={styles.input} placeholder="ID do treino (vazio para criar)" value={workoutForm.id} onChangeText={(value) => setWorkoutForm((prev) => ({ ...prev, id: value }))} />
          <TextInput style={styles.input} placeholder="Título do treino" value={workoutForm.title} onChangeText={(value) => setWorkoutForm((prev) => ({ ...prev, title: value }))} />
          <TextInput style={styles.input} placeholder="Dia da semana (1-7)" keyboardType="number-pad" value={workoutForm.day} onChangeText={(value) => setWorkoutForm((prev) => ({ ...prev, day: value }))} />
          <TextInput
            style={styles.input}
            placeholder="IDs dos exercícios separados por vírgula"
            value={workoutForm.exerciseIds}
            onChangeText={(value) => setWorkoutForm((prev) => ({ ...prev, exerciseIds: value }))}
          />
          <Pressable style={styles.button} onPress={handleSaveWorkout}>
            <Text style={styles.buttonLabel}>Salvar treino</Text>
          </Pressable>
          <Text style={styles.helper}>Dias: {dayOptions.map((day) => `${day.value}=${day.label}`).join(' | ')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Referência rápida</Text>
          <Text style={styles.helper}>Treinos atuais</Text>
          {workouts.map((workout) => (
            <Text key={workout.id} style={styles.listItem}>
              #{workout.id} · D{workout.day_of_week} · {workout.title}
            </Text>
          ))}
          <Text style={[styles.helper, styles.spaced]}>Exercícios atuais</Text>
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
