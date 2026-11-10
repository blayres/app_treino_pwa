import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { showAlert } from '../store/useDialogStore';
import { useI18n } from '../i18n';
import { layout } from '../theme';
import { calendarDaysBetween } from '../utils/date';
import { localeTag } from '../utils/decimal';
import { LogoBar } from '../components/LogoBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionCard } from '../components/SectionCard';
import { ActionButton } from '../components/ActionButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { Skeleton } from '../components/Skeleton';
import { InitialAvatar } from '../components/InitialAvatar';
import { CalendarFrequency } from '../components/CalendarFrequency';
import { getCachedStudent, getStudent, unlinkStudent, type StudentSummary } from '../services/coachService';
import { loadProgramDraft, peekProgramDraft, visibleDays, type DraftDay } from '../services/programService';
import { invalidateWorkoutsByUserCache } from '../services/workoutService';
import { styles } from './Coach.styles';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'CoachStudent'>;
type Route = RouteProp<RootStackParamList, 'CoachStudent'>;

/**
 * A student, seen by their coach: activity at a glance, the weekly program
 * (build / edit it in the same editor as "Meu treino"), attendance calendar
 * and loads progress.
 */
export default function CoachStudentScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const studentId = Number(route.params.studentId);
  const currentUser = useAppStore((s) => s.currentUser);
  const { t, locale } = useI18n();

  // From the coach's list and the cached program: drawn at once, refreshed below.
  const [student, setStudent] = useState<StudentSummary | null | undefined>(() =>
    currentUser ? getCachedStudent(currentUser.id, studentId) : undefined,
  );
  const [program, setProgram] = useState<DraftDay[] | null>(() => {
    const cached = peekProgramDraft(studentId);
    return cached ? visibleDays(cached) : null;
  });
  const [checkIns, setCheckIns] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [now] = useState(() => new Date());
  const coachId = currentUser?.id;

  const load = useCallback(async () => {
    if (!coachId || !Number.isFinite(studentId)) return;
    try {
      // The program may have just been edited by the student or the coach.
      invalidateWorkoutsByUserCache(studentId);
      const [summary, draft] = await Promise.all([getStudent(coachId, studentId), loadProgramDraft(studentId)]);
      setStudent(summary);
      setProgram(visibleDays(draft));
    } catch (err: any) {
      setStudent((prev) => prev ?? null);
      showAlert(t.saveError, err?.message ?? t.genericError);
    }
  }, [coachId, studentId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Coach'));

  if (!currentUser) return null;

  const handleRemove = async () => {
    setConfirmRemove(false);
    try {
      await unlinkStudent(studentId);
      goBack();
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.genericError);
    }
  };

  const lastWorkout = () => {
    if (!student?.lastWorkoutAt) return '—';
    const days = calendarDaysBetween(new Date(student.lastWorkoutAt), now);
    return days <= 0 ? t.lastWorkoutToday : t.lastWorkoutDays(days);
  };

  const since = student
    ? new Date(student.since).toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const openProgram = () =>
    student && navigation.navigate('CoachProgram', { studentId: student.id, studentName: student.name });

  const renderStat = (label: string, value: string) => (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );

  const renderContent = (s: StudentSummary) => (
    <>
      <View style={styles.profileRow}>
        <InitialAvatar name={s.name} size={52} />
        <View style={styles.profileText}>
          <Text style={styles.profileName} numberOfLines={1} accessibilityRole="header">{s.name}</Text>
          <Text style={styles.profileSince}>{t.studentSince(since)}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        {renderStat(t.statLast7, t.workoutsCount(s.sessionsLast7))}
        {renderStat(t.statLast30, t.workoutsCount(s.sessionsLast30))}
        {renderStat(t.statLastWorkout, lastWorkout())}
      </View>

      <SectionCard title={t.studentProgram}>
        {program === null ? (
          [0, 1, 2].map((i) => (
            <View key={i} style={styles.dayRow}>
              <Skeleton width={56} height={12} />
              <View style={styles.dayBody}>
                <Skeleton width="70%" height={15} />
                <Skeleton width="35%" height={12} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))
        ) : program.length === 0 ? (
          <Text style={styles.empty}>{t.studentNoProgram}</Text>
        ) : (
          program.map((day) => (
            <View key={day.key} style={styles.dayRow}>
              <Text style={styles.dayName}>{t.dayLabels[day.dayOfWeek]}</Text>
              <View style={styles.dayBody}>
                <Text style={styles.dayTitle} numberOfLines={1}>{day.title}</Text>
                <Text style={styles.dayMeta}>{t.exercisesCount(day.items.length)}</Text>
              </View>
            </View>
          ))
        )}
        <View style={styles.cardAction}>
          <ActionButton label={program?.length === 0 ? t.buildProgram : t.editProgram} onPress={openProgram} />
        </View>
      </SectionCard>

      <SectionCard title={t.frequency} rightLabel={checkIns}>
        <CalendarFrequency
          userId={s.id}
          onLoad={(count, total) => setCheckIns(t.checkInCountLabel(count, total))}
        />
      </SectionCard>

      <SectionCard title={t.progress}>
        <View style={styles.cardAction}>
          <ActionButton
            label={t.viewLoadProgress}
            variant="secondary"
            onPress={() => navigation.navigate('StudentProgress', { studentId: s.id, studentName: s.name })}
          />
        </View>
      </SectionCard>

      <Pressable onPress={() => setConfirmRemove(true)} accessibilityRole="button" style={styles.dangerRow}>
        <Text style={styles.dangerLabel}>{t.removeStudent}</Text>
      </Pressable>
    </>
  );

  return (
    <SafeAreaView style={layout.screen} edges={['left', 'right']}>
      <LogoBar />
      <ScrollView contentContainerStyle={layout.content}>
        <ScreenHeader onBack={goBack} />
        {student === undefined ? (
          <View style={styles.skeletons}>
            <Skeleton width="60%" height={52} />
            <Skeleton width="100%" height={80} />
            <Skeleton width="100%" height={240} />
          </View>
        ) : student === null ? (
          <Text style={styles.empty}>{t.studentNotFound}</Text>
        ) : (
          renderContent(student)
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmRemove}
        title={student ? t.removeStudentTitle(student.name) : ''}
        message={t.removeStudentMsg}
        confirmLabel={t.removeStudentConfirm}
        cancelLabel={t.cancel}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
        confirmDanger
      />
    </SafeAreaView>
  );
}
