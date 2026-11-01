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
import { ConfirmModal } from '../components/ConfirmModal';
import { Skeleton } from '../components/Skeleton';
import { StudentRow } from '../components/StudentRow';
import {
  becomeCoach,
  countNeedingAttention,
  filterStudents,
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

  const [code, setCode] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [now] = useState(() => new Date());
  const userId = currentUser?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const myCode = await getCoachCode(userId);
      setCode(myCode);
      setStudents(myCode ? await listStudents(userId) : []);
    } catch (err: any) {
      setStudents((prev) => prev ?? []);
      showAlert(t.saveError, err?.message ?? t.genericError);
    }
  }, [userId, t]);

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
        <ScreenHeader onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Home'))} title={t.coachArea} subtitle={t.coachAreaSubtitle} />
        {loading ? (
          <View style={styles.skeletons}>
            <Skeleton width="100%" height={180} />
            <Skeleton width="100%" height={220} />
          </View>
        ) : code ? (
          // No students yet: the invite is the next step, so it comes first.
          students?.length ? (
            <>
              {renderStudents()}
              {renderInvite()}
            </>
          ) : (
            <>
              {renderInvite()}
              {renderStudents()}
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
