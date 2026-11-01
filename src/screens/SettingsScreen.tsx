import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ConfirmModal } from '../components/ConfirmModal';
import { useI18n } from '../i18n';
import { deleteCurrentAccount, getCurrentUserEmail, logout, updateCurrentUserName } from '../services/authService';
import { useAppStore } from '../store/useAppStore';
import { styles } from './SettingsScreen.styles';
import { showAlert } from '../store/useDialogStore';
import { LogoBar } from '../components/LogoBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { getMyCoach, joinCoach, joinErrorKey } from '../services/coachService';
import { useTourStore } from '../store/useTourStore';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export default function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);
  const setActiveSession = useAppStore((state) => state.setActiveSession);
  const { t } = useI18n();
  const [name, setName] = useState(currentUser?.name ?? '');
  const [email, setEmail] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    getCurrentUserEmail().then(setEmail).catch(() => setEmail(''));
  }, []);

  if (!currentUser) return null;

  const returnToLogin = () => {
    setActiveSession(null);
    setCurrentUser(null);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    try {
      await logout();
      returnToLogin();
    } catch (error: any) {
      showAlert(t.errorLogout, error?.message ?? t.errorLogoutMsg);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim() || savingName) return;
    setSavingName(true);
    try {
      const user = await updateCurrentUserName(currentUser.id, name);
      setCurrentUser(user);
      setName(user.name);
      showAlert(t.savedSuccess, t.usernameUpdated);
    } catch (error: any) {
      showAlert(t.saveError, error?.message ?? t.usernameUpdateError);
    } finally {
      setSavingName(false);
    }
  };

  const handleDeleteAccount = () => {
    if (deleting) return;
    setDeleteError('');
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteCurrentAccount();
      returnToLogin();
    } catch (error: any) {
      setDeleteError(error?.message ?? t.deleteAccountError);
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <LogoBar />
      <View style={styles.header}>
        <ScreenHeader onBack={() => navigation.goBack()} title={t.settings} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.languageRow}>
            <Text style={styles.cardTitle}>{t.language}</Text>
            <LanguageSwitcher />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.planHeading}>
            <Text style={styles.cardTitle}>{t.plan}</Text>
            <Text style={styles.comingSoon}>{t.comingSoon}</Text>
          </View>
          <View style={styles.planOptions}>
            <View style={[styles.planOption, styles.planOptionSelected]}>
              <Text style={styles.planName}>{t.freePlan}</Text>
            </View>
            <Pressable
              disabled
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              style={[styles.planOption, styles.planOptionDisabled]}
            >
              <Text style={styles.planName}>{t.premiumPlan}</Text>
            </Pressable>
          </View>
        </View>

        <CoachCard onOpenCoachArea={() => navigation.navigate('Coach')} />

        <View style={styles.card}>
          <Pressable
            onPress={() => {
              useTourStore.getState().replay();
              navigation.navigate('Home');
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionRow, styles.noTopMargin, pressed && styles.buttonPressed]}
          >
            <View style={styles.actionText}>
              <Text style={styles.actionLabel}>{t.tourReplay}</Text>
              <Text style={styles.actionDesc}>{t.tourReplayDesc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.account}</Text>
          <Text style={styles.fieldLabel}>{t.email}</Text>
          <TextInput
            value={email}
            placeholder="—"
            editable={false}
            selectTextOnFocus
            style={[styles.input, styles.readOnlyInput]}
            accessibilityLabel={t.email}
          />
          <Text style={styles.fieldLabel}>{t.changeUsername}</Text>
          <View style={styles.usernameRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder={t.username}
              autoCapitalize="words"
              maxLength={80}
              accessibilityLabel={t.username}
            />
            <Pressable
              onPress={handleSaveName}
              disabled={!name.trim() || savingName}
              style={({ pressed }) => [
                styles.saveButton,
                !name.trim() && styles.buttonDisabled,
                savingName && styles.saveButtonSaving,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.saveButtonLabel}>{t.saveTitle}</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => setShowLogoutConfirm(true)} style={({ pressed }) => [styles.actionRow, pressed && styles.buttonPressed]}>
            <Text style={styles.actionLabel}>{t.logout}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            disabled={deleting}
            style={({ pressed }) => [styles.actionRow, styles.dangerRow, deleting && styles.buttonDisabled, pressed && styles.buttonPressed]}
          >
            <Text style={styles.dangerLabel}>{t.deleteAccount}</Text>
            <Text style={styles.dangerChevron}>›</Text>
          </Pressable>
          {deleteError ? (
            <Text style={styles.errorText} accessibilityRole="alert">{deleteError}</Text>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showLogoutConfirm}
        title={t.logoutConfirmTitle}
        message={t.logoutConfirmMsg}
        confirmLabel={t.logout}
        cancelLabel={t.cancel}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <ConfirmModal
        visible={showDeleteConfirm}
        title={t.deleteAccountTitle}
        message={t.deleteAccountMsg}
        confirmLabel={t.deleteAccountConfirm}
        cancelLabel={t.cancel}
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmDanger
      />
    </SafeAreaView>
  );
}

/**
 * "Personal", only for users without a coach: join one by code, or open the
 * trainer area. Students who already have a coach don't see it (leaving is
 * agreed with the coach, who removes them).
 */
function CoachCard({ onOpenCoachArea }: { onOpenCoachArea: () => void }) {
  const { t } = useI18n();
  const [hasCoach, setHasCoach] = useState<boolean | undefined>(undefined);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyCoach()
      .then((coach) => setHasCoach(coach !== null))
      .catch(() => setHasCoach(false));
  }, []);

  if (hasCoach !== false) return null;

  const handleJoin = async () => {
    if (!code.trim() || joining) return;
    setJoining(true);
    setError('');
    try {
      const name = await joinCoach(code);
      setCode('');
      setHasCoach(true);
      showAlert('', t.joinedCoach(name));
    } catch (err: any) {
      const key = joinErrorKey(err);
      setError(key ? t[key] : err?.message ?? t.genericError);
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t.myCoach}</Text>
      <Text style={styles.fieldLabel}>{t.haveCoachQuestion}</Text>
      <View style={styles.usernameRow}>
        <TextInput
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
            setError('');
          }}
          onSubmitEditing={handleJoin}
          style={styles.input}
          placeholder={t.coachCodePlaceholder}
          accessibilityLabel={t.coachCodePlaceholder}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
        />
        <Pressable
          onPress={handleJoin}
          disabled={!code.trim() || joining}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.saveButton,
            !code.trim() && styles.buttonDisabled,
            joining && styles.saveButtonSaving,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.saveButtonLabel}>{t.joinCoachButton}</Text>
        </Pressable>
      </View>
      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
      ) : null}

      <Pressable
        onPress={onOpenCoachArea}
        accessibilityRole="button"
        accessibilityHint={t.openCoachAreaDesc}
        style={({ pressed }) => [styles.actionRow, pressed && styles.buttonPressed]}
      >
        <View style={styles.actionText}>
          <Text style={styles.actionLabel}>{t.coachArea}</Text>
          <Text style={styles.actionDesc}>{t.openCoachAreaDesc}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}
