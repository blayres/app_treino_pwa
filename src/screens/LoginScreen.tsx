import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './LoginScreen.styles';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { backendMode } from '../services/backendMode';
import { getLocalUsers, loginWithEmail, setLocalCurrentUser } from '../services/authService';
import { mapAuthError } from '../services/authErrorMapper';
import { feedbackStyles } from './FeedbackStyles';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { OrDivider } from '../components/OrDivider';
import { signInWithGoogle } from '../services/authService';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Login'>;
type Route = NativeStackScreenProps<RootStackParamList, 'Login'>['route'];

export default function LoginScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const { t } = useI18n();
  const [users, setUsers] = React.useState<{ id: number; name: string }[]>([]);
  const [email, setEmail] = React.useState(route.params?.email ?? '');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const passwordRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    if (backendMode !== 'local') return;
    (async () => {
      const rows = await getLocalUsers();
      setUsers(rows);
    })();
  }, []);

  const handleSelectUser = async (id: number) => {
    const user = await setLocalCurrentUser(id);
    if (!user) return;
    setCurrentUser(user);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleSupabaseLogin = async () => {
    setError('');

    if (!email || !password) {
      setError(t.requiredFieldsMsg);
      return;
    }
    try {
      await loginWithEmail(email.trim(), password);
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
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // OAuth opens the browser — the auth state change listener in App.tsx
      // handles the session once the user returns from the Google consent screen.
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
      <View style={styles.container}>
        <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
          <LanguageSwitcher />
        </View>
        {backendMode === 'supabase' ? (
          <>
            <Text style={styles.title}>{t.signIn}</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder={t.emailPlaceholder}
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel={t.emailPlaceholder}
            />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              placeholder={t.passwordPlaceholder}
              returnKeyType="done"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSupabaseLogin}
              accessibilityLabel={t.passwordPlaceholder}
            />

            {error ? (
              <View style={feedbackStyles.errorBox}>
                <Text style={feedbackStyles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={handleSupabaseLogin}
              accessibilityRole="button"
              accessibilityLabel={t.accessButton}
            >
              <Text style={styles.buttonLabel}>{t.accessButton}</Text>
            </Pressable>

            <OrDivider />

            <GoogleSignInButton
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            />

            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              hitSlop={8}
              style={styles.linkWrap}
              accessibilityRole="link"
            >
              <Text style={styles.linkLabel}>{t.forgotPassword}</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Signup')}
              hitSlop={8}
              style={styles.linkWrap}
              accessibilityRole="link"
            >
              <Text style={styles.linkLabel}>{t.createAccount}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>{t.chooseProfile}</Text>
            <View style={styles.buttons}>
              {users.map((user) => (
                <Pressable
                  key={user.id}
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                  onPress={() => handleSelectUser(user.id)}
                  accessibilityRole="button"
                  accessibilityLabel={user.name}
                >
                  <Text style={styles.buttonLabel}>{user.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
