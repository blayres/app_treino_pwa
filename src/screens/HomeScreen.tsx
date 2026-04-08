import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './HomeScreen.styles';
import { useAppStore } from '../store/useAppStore';
import { SectionCard } from '../components/SectionCard';
import { CalendarFrequency } from '../components/CalendarFrequency';
import { DayWorkouts } from '../components/DayWorkouts';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore(state => state.currentUser);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const calendarRef = useRef<{ refresh: () => void }>(null);
  const [checkInLabel, setCheckInLabel] = useState('');

  if (!currentUser) {
    return null;
  }

  useFocusEffect(
    React.useCallback(() => {
      calendarRef.current?.refresh();
    }, []),
  );

  const handleLogout = () => {
    setCurrentUser(null);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
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
            <Text style={styles.logoutLabel}>Trocar usuário</Text>
          </Pressable>
        </View>

        <SectionCard title="Frequência" rightLabel={checkInLabel}>
          <CalendarFrequency
            ref={calendarRef}
            userId={currentUser.id}
            onLoad={(count, total) => setCheckInLabel(`${count}/${total}`)}
          />
        </SectionCard>

        <SectionCard title="Treinos da semana">
          <DayWorkouts userId={currentUser.id} />
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
