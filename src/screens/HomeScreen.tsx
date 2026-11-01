import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from './HomeScreen.styles';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../theme';
import { SectionCard } from '../components/SectionCard';
import { CalendarFrequency } from '../components/CalendarFrequency';
import { DayWorkouts } from '../components/DayWorkouts';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useI18n } from '../i18n';
import { PencilIcon } from '../components/PencilIcon';
import { LogoBar } from '../components/LogoBar';
import { ProgramUpdateReminder } from '../components/ProgramUpdateReminder';
import { ActionButton } from '../components/ActionButton';
import { InitialAvatar } from '../components/InitialAvatar';
import { getCoachCode } from '../services/coachService';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore(state => state.currentUser);
  const calendarRef = useRef<{ refresh: () => void }>(null);
  const hasFocusedOnceRef = useRef(false);
  const [checkInLabel, setCheckInLabel] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showWorkoutCompleted, setShowWorkoutCompleted] = useState(false);
  const [isCoach, setIsCoach] = useState(false);

  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const refreshHomeData = useCallback(() => {
    calendarRef.current?.refresh();
    setRefreshKey(k => k + 1);
  }, []);

  // Trainers get a shortcut to their students.
  const userId = currentUser?.id;
  useEffect(() => {
    if (!userId) return;
    getCoachCode(userId).then((code) => setIsCoach(code !== null)).catch(() => setIsCoach(false));
  }, [userId]);

  useEffect(() => {
    const handleWorkoutSessionUpdated = () => refreshHomeData();
    document.addEventListener('workoutSessionUpdated', handleWorkoutSessionUpdated);
    return () => document.removeEventListener('workoutSessionUpdated', handleWorkoutSessionUpdated);
  }, [refreshHomeData]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }

      refreshHomeData();

      if (sessionStorage.getItem('workoutCompletedToast')) {
        sessionStorage.removeItem('workoutCompletedToast');

        setShowWorkoutCompleted(true);

        setTimeout(() => {
          setShowWorkoutCompleted(false);
        }, 3000);
      }
    }, [refreshHomeData]),
  );

  // currentUser is guaranteed by authStatus === 'authenticated' in App.tsx
  if (!currentUser) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {showWorkoutCompleted && (
        <View style={[styles.successToast, { top: insets.top + 16 }]}>
          <Text style={styles.successToastText}>
            ✓ {t.workoutCompleted}
          </Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <LogoBar />

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.greetingWrapper}>
              <View style={styles.greetingRow}>
                <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">{t.greeting(currentUser.name)}</Text>
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => navigation.navigate('Settings')}
                    hitSlop={10}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.settingsButton,
                      hovered && styles.settingsButtonHovered,
                      pressed && styles.settingsButtonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t.settings}
                  >
                    <InitialAvatar name={currentUser.name} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.subtitle}>{t.homeSubtitle}</Text>
            </View>
          </View>

          <ProgramUpdateReminder
            userId={currentUser.id}
            refreshKey={refreshKey}
            onUpdate={() => navigation.navigate('MyWorkout')}
          />

          <SectionCard
            title={t.workoutsThisWeek}
            rightElement={
              <Pressable
                onPress={() => navigation.navigate('MyWorkout')}
                hitSlop={10}
                style={({ pressed }) => [homeStyles.pencilButton, pressed && homeStyles.pencilButtonPressed]}
                accessibilityRole="button"
                accessibilityLabel={t.customizeMyWorkout}
              >
                <PencilIcon size={15} color={colors.olive} opacity={0.65} />
              </Pressable>
            }
          >
            <DayWorkouts userId={currentUser.id} refreshKey={refreshKey} />
          </SectionCard>

          <SectionCard title={t.frequency} rightLabel={checkInLabel}>
            <CalendarFrequency
              ref={calendarRef}
              userId={currentUser.id}
              onLoad={(count, total) => setCheckInLabel(t.checkInCountLabel(count, total))}
            />
          </SectionCard>

          <SectionCard title={t.progress}>
            <Text style={styles.sectionDescription}>{t.progressSubtitle}</Text>
            <View style={styles.cardAction}>
              <ActionButton label={t.viewMyProgress} onPress={() => navigation.navigate('Progress')} />
            </View>
          </SectionCard>

          <SectionCard title={t.myWorkout}>
            <Text style={styles.sectionDescription}>{t.myWorkoutDescription}</Text>
            <View style={styles.cardAction}>
              <ActionButton label={t.customizeMyWorkout} onPress={() => navigation.navigate('MyWorkout')} />
            </View>
          </SectionCard>

          {isCoach && (
            <SectionCard title={t.myStudents}>
              <Text style={styles.sectionDescription}>{t.homeCoachDesc}</Text>
              <View style={styles.cardAction}>
                <ActionButton label={t.viewStudents} onPress={() => navigation.navigate('Coach')} />
              </View>
            </SectionCard>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const homeStyles = StyleSheet.create({
  pencilButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pencilButtonPressed: {
    opacity: 0.4,
  },
});
