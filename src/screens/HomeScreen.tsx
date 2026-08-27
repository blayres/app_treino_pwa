import React, { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from './HomeScreen.styles';
import { useAppStore } from '../store/useAppStore';
import { SectionCard } from '../components/SectionCard';
import { CalendarFrequency } from '../components/CalendarFrequency';
import { DayWorkouts } from '../components/DayWorkouts';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { logout } from '../services/authService';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore(state => state.currentUser);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const calendarRef = useRef<{ refresh: () => void }>(null);
  const hasFocusedOnceRef = useRef(false);
  const [checkInLabel, setCheckInLabel] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showWorkoutCompleted, setShowWorkoutCompleted] = useState(false);

  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }

      calendarRef.current?.refresh();
      setRefreshKey(k => k + 1);

      if (sessionStorage.getItem('workoutCompletedToast')) {
        sessionStorage.removeItem('workoutCompletedToast');

        setShowWorkoutCompleted(true);

        setTimeout(() => {
          setShowWorkoutCompleted(false);
        }, 3000);
      }
    }, []),
  );

  // currentUser is guaranteed by authStatus === 'authenticated' in App.tsx
  if (!currentUser) return null;

  const handleLogout = () => {
    (async () => {
      try {
        await logout();
      } catch (error: any) {
        Alert.alert(t.errorLogout, error?.message ?? t.errorLogoutMsg);
      }
    })();
    setCurrentUser(null);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

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
        <View style={[styles.logoBar, { paddingTop: insets.top }]}>
          <Image
            source={require('../../assets/logo_completed_light_background.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no"
            // @ts-ignore — web-only prop; tells the browser not to lazy-load this above-fold image
            loading="eager"
          />
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.greetingWrapper}>
              <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">{t.greeting(currentUser.name)}</Text>
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

          <SectionCard title={t.myWorkout}>
            <Text style={styles.sectionDescription}>{t.myWorkoutDescription}</Text>
            <Pressable
              style={({ pressed }) => [styles.customizeButton, pressed && styles.customizeButtonPressed]}
              onPress={() => navigation.navigate('MyWorkout')}
            >
              <Text style={styles.customizeButtonLabel}>{t.customizeMyWorkout}</Text>
            </Pressable>
          </SectionCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
