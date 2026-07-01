import React from 'react';
import { View, Text, Pressable, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './LoginScreen.styles';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAppStore } from '../store/useAppStore';
import { backendMode } from '../services/backendMode';
import { getLocalUsers, loginWithEmail, setLocalCurrentUser, signInWithGoogle, getSessionUser } from '../services/authService';
import { useI18n } from '../i18n';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Navigation>();
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const { t } = useI18n();
  const [users, setUsers] = React.useState<{ id: number; name: string }[]>([]);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

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
    if (!email || !password) {
      Alert.alert(t.requiredFields, t.requiredFieldsMsg);
      return;
    }
    try {
      await loginWithEmail(email.trim(), password);
    } catch (error: any) {
      Alert.alert(t.loginError, error?.message ?? t.loginErrorMsg);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {backendMode === 'supabase' ? (
          <>
            <Text style={styles.title}>{t.signIn}</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={t.emailPlaceholder}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
              placeholder={t.passwordPlaceholder}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={handleSupabaseLogin}
            >
              <Text style={styles.buttonLabel}>{t.accessButton}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8} style={styles.linkWrap}>
              <Text style={styles.linkLabel}>{t.forgotPassword}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8} style={styles.linkWrap}>
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
