import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoBar } from '../components/LogoBar';
import { ScreenShell } from '../components/ScreenShell';
import { Skeleton } from '../components/Skeleton';
import { WorkoutExercisesSkeleton } from '../components/WorkoutExercisesSkeleton';
import { CoachStudentSkeleton } from '../components/CoachStudentSkeleton';
import { MyTrainingButton } from '../components/MyTrainingButton';
import { styles as workoutStyles } from '../screens/WorkoutScreen.styles';
import { useI18n } from '../i18n';
import { LiveTimer } from '../components/LiveTimer';
import { FORGOTTEN_SESSION_SECONDS } from '../services/sessionService';
import { useAppStore } from '../store/useAppStore';

/**
 * What each code-split screen shows if it is opened before its code arrived
 * (normally it is preloaded right after the first paint). Static texts come
 * from i18n, so they are the real ones; only data areas are skeletons.
 */
type FallbackProps = {
  navigation: { goBack: () => void; canGoBack?: () => boolean; navigate?: (name: 'Home') => void };
  route?: { params?: any };
};

const back = (navigation: FallbackProps['navigation']) => () => navigation.goBack();

export function SettingsFallback({ navigation }: FallbackProps) {
  const { t } = useI18n();
  return <ScreenShell onBack={back(navigation)} title={t.settings} cards={[72, 120, 120, 96]} />;
}

export function ProgressFallback({ navigation, route }: FallbackProps) {
  const { t } = useI18n();
  const student = route?.params?.studentId != null;
  return (
    <ScreenShell
      onBack={back(navigation)}
      title={student ? t.studentProgressTitle(route?.params?.studentName ?? '') : t.progress}
      subtitle={student ? t.studentProgressSubtitle : t.progressHeaderSubtitle}
      cards={[40, 96, 280]}
    />
  );
}

export function MyWorkoutFallback({ navigation, route }: FallbackProps) {
  const { t } = useI18n();
  const student = route?.params?.studentId != null;
  return (
    <ScreenShell
      onBack={back(navigation)}
      title={student ? t.studentProgramTitle(route?.params?.studentName ?? '') : t.myWorkoutOverviewTitle}
      subtitle={student ? t.studentProgramSubtitle : t.myWorkoutSubtitle}
      cards={[120, 120, 120]}
    />
  );
}

export function CoachFallback({ navigation }: FallbackProps) {
  const { t } = useI18n();
  return (
    <ScreenShell
      onBack={back(navigation)}
      title={t.coachArea}
      subtitle={t.coachAreaSubtitle}
      action={<MyTrainingButton onPress={() => navigation.navigate?.('Home')} />}
      cards={[180, 220]}
    />
  );
}

/** Coach's exercise videos. */
export function CoachVideosFallback({ navigation }: FallbackProps) {
  const { t } = useI18n();
  return <ScreenShell onBack={back(navigation)} title={t.coachVideosTitle} subtitle={t.coachVideosDesc} cards={[44, 64, 64, 64]} />;
}

/** Student page (coach): real layout with skeletons for the student's data. */
export function CoachStudentFallback({ navigation }: FallbackProps) {
  return (
    <ScreenShell onBack={back(navigation)}>
      <CoachStudentSkeleton />
    </ScreenShell>
  );
}

export function GenericFallback({ navigation }: FallbackProps) {
  return <ScreenShell onBack={navigation.canGoBack?.() ? back(navigation) : undefined} />;
}

/** Workout: real header (title comes with the navigation) + exercise skeleton. */
export function WorkoutFallback({ navigation, route }: FallbackProps) {
  const { t } = useI18n();
  const title: string | undefined = route?.params?.workoutTitle;
  const session = useAppStore((state) => state.activeSession);
  const running = session?.isRunning && session.workoutId === Number(route?.params?.workoutId) ? session : null;
  return (
    <SafeAreaView style={workoutStyles.safe} edges={['left', 'right', 'bottom']}>
      <LogoBar />
      <View style={workoutStyles.header}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} hitSlop={16}>
          <Text style={workoutStyles.backLabel}>{t.back}</Text>
        </Pressable>
        <Text style={workoutStyles.title}>{title || <Skeleton width={250} height={22} />}</Text>
      </View>
      {/* Same timer and buttons as the real screen; inert for the instant the code is missing. */}
      <View style={workoutStyles.timerRow}>
        <LiveTimer startedAt={running ? running.startedAt : new Date().toISOString()} capSeconds={running ? FORGOTTEN_SESSION_SECONDS : 0} />
        <View style={workoutStyles.actions}>
          {running ? (
            <>
              <View style={workoutStyles.buttonSecondary}>
                <Text style={workoutStyles.buttonSecondaryLabel}>{t.discardWorkout}</Text>
              </View>
              <View style={workoutStyles.buttonPrimary}>
                <Text style={workoutStyles.buttonPrimaryLabel}>{t.finish}</Text>
              </View>
            </>
          ) : (
            <View style={workoutStyles.buttonPrimary}>
              <Text style={workoutStyles.buttonPrimaryLabel}>{t.startWorkout}</Text>
            </View>
          )}
        </View>
      </View>
      <WorkoutExercisesSkeleton />
    </SafeAreaView>
  );
}
