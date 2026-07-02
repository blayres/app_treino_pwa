import React, { useRef, useState, useCallback } from 'react';
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
import { logout } from '../services/authService';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore(state => state.currentUser);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const clearActiveWorkout = useAppStore(state => state.clearActiveWorkout);
  const calendarRef = useRef<{ refresh: () => void }>(null);
  const hasFocusedOnceRef = useRef(false);
  const [checkInLabel, setCheckInLabel] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { t } = useI18n();

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }

      calendarRef.current?.refresh();
      setRefreshKey(k => k + 1);
    }, []),
  );

  // currentUser is guaranteed by authStatus === 'authenticated' in App.tsx
  if (!currentUser) return null;

  const handleLogout = () => {
    (async () => {
      try {
        await logout();
      } catch (error: unknown) {
        Alert.alert(
          t.errorLogout,
          error instanceof Error ? error.message : t.errorLogoutMsg,
        );
      }
    })();
    clearActiveWorkout();
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
            <Text style={styles.greeting}>{t.greeting(currentUser.name)}</Text>
            <Text style={styles.subtitle}>{t.homeSubtitle}</Text>
          </View>
          <View style={styles.actionsRow}>
            <LanguageSwitcher />
            <Pressable onPress={handleLogout} hitSlop={8} style={styles.logoutButton}>
              <Text style={styles.logoutLabel}>{t.logout}</Text>
            </Pressable>
          </View>
        </View>

        <SectionCard title={t.workoutsThisWeek}>
          <DayWorkouts userId={currentUser.id} refreshKey={refreshKey} />
        </SectionCard>

        <SectionCard title={t.frequency} rightLabel={checkInLabel}>
          <CalendarFrequency
            ref={calendarRef}
            userId={currentUser.id}
            onLoad={(count, total) => setCheckInLabel(t.checkInCountLabel(count, total))}
          />
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
