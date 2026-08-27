import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

import { styles } from './LoginScreen.styles';
import { feedbackStyles } from './FeedbackStyles';

import { signUpWithEmail, signInWithGoogle } from '../services/authService';
import { mapAuthError } from '../services/authErrorMapper';

import { useI18n } from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { OrDivider } from '../components/OrDivider';
import { colors } from '../theme/colors';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useI18n();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const emailRef = React.useRef<TextInput>(null);
  const passwordRef = React.useRef<TextInput>(null);
  const confirmPasswordRef = React.useRef<TextInput>(null);

  const handleSignUp = async () => {
    setSuccess('');
    setError('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError(t.nameRequired);
      return;
    }

    if (!trimmedEmail) {
      setError(t.emailRequired);
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError(t.invalidEmail);
      return;
    }

    if (!password) {
      setError(t.passwordRequired);
      return;
    }

    if (password.length < 8) {
      setError(t.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }

    setLoading(true);

    try {
      await signUpWithEmail(trimmedEmail, password, trimmedName);

      setSuccess(t.signupSuccess);
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login', params: { email: trimmedEmail } }],
        });
      }, 1800);
    } catch (err: any) {
      setError(
        mapAuthError(err?.message, {
          invalidCredentials: t.invalidCredentials,
          emailNotConfirmed: t.emailNotConfirmed,
          accountAlreadyExists: t.accountAlreadyExists,
          passwordTooWeak: t.passwordTooWeak,
          networkError: t.networkError,
          genericError: t.genericError,
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // OAuth opens the browser — App.tsx handles the session on return.
    } catch (err: any) {
      setError(
        mapAuthError(err?.message, {
          invalidCredentials: t.invalidCredentials,
          emailNotConfirmed: t.emailNotConfirmed,
          accountAlreadyExists: t.accountAlreadyExists,
          passwordTooWeak: t.passwordTooWeak,
          networkError: t.networkError,
          genericError: t.genericError,
        }),
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.container}
        >

          <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
            <LanguageSwitcher />
          </View>

          <Text style={styles.title}>
            {t.createAccountTitle}
          </Text>

          <Text style={styles.subtitle}>
            {t.createAccountSubtitle}
          </Text>

          <TextInput
            style={styles.input}
            placeholder={t.namePlaceholder}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            editable={!loading}
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => emailRef.current?.focus()}
            accessibilityLabel={t.namePlaceholder}
          />

          <TextInput
            ref={emailRef}
            style={styles.input}
            placeholder={t.emailPlaceholder}
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            editable={!loading}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel={t.emailPlaceholder}
          />

          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder={t.passwordPlaceholder}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            editable={!loading}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            accessibilityLabel={t.passwordPlaceholder}
          />

          <TextInput
            ref={confirmPasswordRef}
            style={styles.input}
            placeholder={t.confirmPasswordPlaceholder}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            editable={!loading}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onSubmitEditing={handleSignUp}
            accessibilityLabel={t.confirmPasswordPlaceholder}
          />

          {success ? (
            <View style={feedbackStyles.successBox}>
              <Text style={feedbackStyles.successText}>{success}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={feedbackStyles.errorBox}>
              <Text style={feedbackStyles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              styles.mt,
              loading && { opacity: 0.6 },
            ]}
            onPress={handleSignUp}
            accessibilityRole="button"
            accessibilityLabel={t.signupButtonLabel}
          >
            <Text style={styles.buttonLabel}>
              {t.signupButtonLabel}
            </Text>
          </Pressable>

          <OrDivider />

          <GoogleSignInButton
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
          />

          <Pressable
            disabled={loading}
            onPress={() => navigation.navigate('Login')}
            hitSlop={8}
            style={styles.linkWrap}
            accessibilityRole="link"
            accessibilityLabel={t.alreadyHaveAccount}
          >
            <Text style={styles.linkLabel}>
              {t.alreadyHaveAccount}
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
