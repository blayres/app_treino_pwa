import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './HomeScreen.styles';
import { useAppStore } from '../store/useAppStore';
import { SectionCard } from '../components/SectionCard';
import { CalendarFrequency } from '../components/CalendarFrequency';
import { DayWorkouts } from '../components/DayWorkouts';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { downloadIndexedDbBackup } from '../services/backupService';
import { backendMode } from '../services/backendMode';
import { logout } from '../services/authService';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore(state => state.currentUser);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const calendarRef = useRef<{ refresh: () => void }>(null);
  const [checkInLabel, setCheckInLabel] = useState('');

if (!currentUser) {
  return (
    <SafeAreaView style={styles.safe}>
      <Text>Carregando usuário...</Text>
    </SafeAreaView>
  );
}

  const handleLogout = () => {
    (async () => {
      try {
        await logout();
      } catch (error: any) {
        Alert.alert('Erro ao sair', error?.message ?? 'Falha ao encerrar sessão.');
      }
    })();
    setCurrentUser(null);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const handleOpenAdmin = () => {
    navigation.navigate('Admin');
  };

  const handleExportBackup = async () => {
    try {
      await downloadIndexedDbBackup();
    } catch (error: any) {
      Alert.alert('Erro ao exportar', error?.message ?? 'Não foi possível exportar o backup.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {currentUser.name}</Text>
            <Text style={styles.subtitle}>Bora treinar hoje?</Text>
          </View>
          <Pressable onPress={handleLogout} hitSlop={8}>
            <Text style={styles.logoutLabel}>Sair</Text>
          </Pressable>
        </View>

        <SectionCard title="Treinos da semana">
          <DayWorkouts userId={currentUser.id} />
        </SectionCard>

        <SectionCard title="Frequência" rightLabel={checkInLabel}>
          <CalendarFrequency
            ref={calendarRef}
            userId={currentUser.id}
            onLoad={(count, total) => setCheckInLabel(`${count}/${total}`)}
          />
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
