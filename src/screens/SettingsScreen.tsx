import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';
import { deleteCurrentAccount, getCurrentUserEmail, logout, updateCurrentUserName } from '../services/authService';
import { useAppStore } from '../store/useAppStore';
import { styles } from './SettingsScreen.styles';

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
    try {
      await logout();
      returnToLogin();
    } catch (error: any) {
      Alert.alert(t.errorLogout, error?.message ?? t.errorLogoutMsg);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim() || savingName) return;
    setSavingName(true);
    try {
      const user = await updateCurrentUserName(currentUser.id, name);
      setCurrentUser(user);
      setName(user.name);
      Alert.alert(t.savedSuccess, t.usernameUpdated);
    } catch (error: any) {
      Alert.alert(t.saveError, error?.message ?? t.usernameUpdateError);
    } finally {
      setSavingName(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(t.deleteAccountTitle, t.deleteAccountMsg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteAccountConfirm,
        style: 'destructive',
        onPress: async () => {
          if (deleting) return;
          setDeleting(true);
          try {
            await deleteCurrentAccount();
            returnToLogin();
          } catch (error: any) {
            Alert.alert(t.saveError, error?.message ?? t.deleteAccountError);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={16} accessibilityRole="button">
          <Text style={styles.backLabel}>{t.back}</Text>
        </Pressable>
        <Text style={styles.screenTitle}>{t.settings}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.language}</Text>
          <View style={styles.languageRow}>
            <Text style={styles.rowDescription}>{t.language}</Text>
            <LanguageSwitcher />
          </View>
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

          <Pressable onPress={handleLogout} style={({ pressed }) => [styles.actionRow, pressed && styles.buttonPressed]}>
            <Text style={styles.actionLabel}>{t.logout}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            disabled={deleting}
            style={({ pressed }) => [styles.actionRow, styles.dangerRow, deleting && styles.buttonDisabled, pressed && styles.buttonPressed]}
          >
            <Text style={styles.dangerLabel}>{deleting ? t.saving : t.deleteAccount}</Text>
            <Text style={styles.dangerChevron}>›</Text>
          </Pressable>
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
      </ScrollView>
    </SafeAreaView>
  );
}
