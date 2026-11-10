import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { showAlert } from '../store/useDialogStore';
import { useI18n } from '../i18n';
import { layout } from '../theme';
import { LogoBar } from '../components/LogoBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionCard } from '../components/SectionCard';
import { FooterButton } from '../components/FooterButton';
import { ActionButton } from '../components/ActionButton';
import { MyTrainingButton } from '../components/MyTrainingButton';
import { useVideoRows } from '../hooks/useExerciseVideos';
import { ownVideos } from '../services/videoService';
import { FEATURES } from '../config/features';
import { ConfirmModal } from '../components/ConfirmModal';
import { Skeleton } from '../components/Skeleton';
import { StudentRow, StudentRowSkeleton } from '../components/StudentRow';
import {
  becomeCoach,
  countNeedingAttention,
  filterStudents,
  getCachedCoachCode,
  getCachedStudents,
  getCoachCode,
  inviteLink,
  listStudents,
  type StudentSummary,
} from '../services/coachService';
import { styles } from './Coach.styles';
import { appOrigin } from '../config/app';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Coach'>;

/** Show the search box only when scrolling the list gets tedious. */
const SEARCH_FROM = 6;

const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

/**
 * Área do personal: invite link + the coach's students with what needs
 * attention (no program yet, stopped training). Tapping a student opens their
 * page (program, attendance, loads).
 */
export default function CoachScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore((s) => s.currentUser);
  const { t } = useI18n();

  const userId = currentUser?.id;
  // Invite code is usually known from Home (fetched at boot): undefined = not yet.
  const [cachedCode] = useState(() => (userId ? getCachedCoachCode(userId) : undefined));
  const [code, setCode] = useState<string | null>(cachedCode ?? null);
  const [students, setStudents] = useState<StudentSummary[] | null>(() => {
    if (!userId) return null;
    // Last loaded list (reopening the area), or nothing to list for a non-coach.
    return getCachedStudents(userId) ?? (cachedCode === null ? [] : null);
  });
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [now] = useState(() => new Date());
  const videoRows = useVideoRows(code && FEATURES.coachVideos ? userId : null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      // A known coach: code and students in parallel; otherwise the code decides.
      const [myCode, list] = await Promise.all([
        getCoachCode(userId),
        cachedCode ? listStudents(userId) : Promise.resolve(null),
      ]);
      setCode(myCode);
      const next = myCode ? list ?? (await listStudents(userId)) : [];
      setStudents(next);
    } catch (err: any) {
      setStudents((prev) => prev ?? []);
      showAlert(t.saveError, err?.message ?? t.genericError);
    }
  }, [userId, t, cachedCode]);

  // Reload when coming back from a student (program built, student removed).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(() => filterStudents(students ?? [], query), [students, query]);
  const openStudent = useCallback(
    (student: StudentSummary) => navigation.navigate('CoachStudent', { studentId: student.id }),
    [navigation],
  );

  if (!currentUser) return null;

  const link = code ? inviteLink(appOrigin(), code) : '';

  const handleBecomeCoach = async (reset = false) => {
    if (busy) return;
    setBusy(true);
    try {
      setCode(await becomeCoach(reset));
      if (!reset) setStudents([]);
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.genericError);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      showAlert('', t.linkCopied);
    } catch {
      showAlert('', link);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `${t.inviteShareText(currentUser.name)}: ${link}`, url: link });
    } catch {
      // Cancelled by the user.
    }
  };

  const loading = students === null;

  const renderIntro = () => (
    <SectionCard title={t.coachIntroTitle}>
      {[t.coachIntroStep1, t.coachIntroStep2, t.coachIntroStep3].map((step, index) => (
        <View key={step} style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberLabel}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </SectionCard>
  );

  const renderInvite = () => (
    <SectionCard title={t.inviteTitle}>
      <Text style={styles.helper}>{t.inviteDesc}</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>{t.inviteCodeLabel}</Text>
        <Text style={styles.code} selectable accessibilityLabel={`${t.inviteCodeLabel}: ${code?.split('').join(' ')}`}>
          {code}
        </Text>
        <Text style={styles.link} selectable numberOfLines={1}>{link}</Text>
      </View>
      <View style={styles.buttonRow}>
        <ActionButton label={t.copyLink} onPress={handleCopy} variant={canShare ? 'secondary' : 'primary'} />
        {canShare && <ActionButton label={t.shareLink} onPress={handleShare} />}
      </View>
      <Pressable onPress={() => setConfirmReset(true)} accessibilityRole="button" hitSlop={8} style={styles.textLink}>
        <Text style={styles.textLinkLabel}>{t.resetCode}</Text>
      </Pressable>
    </SectionCard>
  );

  const videoCount = userId ? ownVideos(videoRows, userId).size : 0;
  // Off until hosting fits the budget (FEATURES.coachVideos).
  const renderVideos = () =>
    FEATURES.coachVideos ? (
      <SectionCard title={t.coachVideosTitle}>
        <Text style={styles.helper}>{t.coachVideosDesc}</Text>
        <Text style={styles.attention}>{t.coachVideosCount(videoCount)}</Text>
        <View style={styles.buttonRow}>
          <ActionButton label={t.manageVideos} variant="secondary" onPress={() => navigation.navigate('CoachVideos')} />
        </View>
      </SectionCard>
    ) : null;

  const attention = countNeedingAttention(students ?? [], now);
  const renderStudents = () => (
    <SectionCard title={t.myStudents} rightLabel={students?.length ? t.studentsCount(students.length) : undefined}>
      {attention > 0 && <Text style={styles.attention}>{t.studentsNeedAttention(attention)}</Text>}
      {(students?.length ?? 0) >= SEARCH_FROM && (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.searchStudent}
          accessibilityLabel={t.searchStudent}
          style={styles.search}
          maxLength={60}
        />
      )}
      {students?.length === 0 ? (
        <Text style={styles.empty}>{t.noStudents}</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>{t.noStudentsFound}</Text>
      ) : (
        visible.map((student) => <StudentRow key={student.id} student={student} now={now} onPress={openStudent} />)
      )}
    </SectionCard>
  );

  return (
    <SafeAreaView style={layout.screen} edges={['left', 'right']}>
      <LogoBar />
      <ScrollView
        contentContainerStyle={[layout.content, !code && !loading && layout.contentWithFooter]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Home'))}
          title={t.coachArea}
          subtitle={t.coachAreaSubtitle}
          // The trainer's own training lives on Home (same account).
          action={<MyTrainingButton onPress={() => navigation.navigate('Home')} />}
        />
        {loading && code ? (
          // Known coach: the invite card is static; only the students load.
          <>
            {renderInvite()}
            <SectionCard title={t.myStudents}>
              <StudentRowSkeleton />
              <StudentRowSkeleton />
              <StudentRowSkeleton />
            </SectionCard>
          </>
        ) : loading ? (
          <View style={styles.skeletons}>
            <Skeleton width="100%" height={180} />
            <Skeleton width="100%" height={220} />
          </View>
        ) : code ? (
          // No students yet: the invite is the next step, so it comes first.
          students?.length ? (
            <>
              {renderStudents()}
              {renderVideos()}
              {renderInvite()}
            </>
          ) : (
            <>
              {renderInvite()}
              {renderStudents()}
              {renderVideos()}
            </>
          )
        ) : (
          renderIntro()
        )}
      </ScrollView>

      {!loading && !code && <FooterButton label={t.becomeCoach} onPress={() => handleBecomeCoach()} loading={busy} />}

      <ConfirmModal
        visible={confirmReset}
        title={t.resetCodeTitle}
        message={t.resetCodeMsg}
        confirmLabel={t.resetCodeConfirm}
        cancelLabel={t.cancel}
        onConfirm={() => {
          setConfirmReset(false);
          void handleBecomeCoach(true);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </SafeAreaView>
  );
}
