import React from 'react';
import { View, Text, Pressable, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './LoginScreen.styles';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAppStore } from '../store/useAppStore';
import { backendMode } from '../services/backendMode';
import { getLocalUsers, loginWithEmail, setLocalCurrentUser, signInWithGoogle } from '../services/authService';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Navigation>();
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
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
      Alert.alert('Campos obrigatórios', 'Informe email e senha.');
      return;
    }
    try {
      await loginWithEmail(email.trim(), password);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (error: any) {
      Alert.alert('Erro de login', error?.message ?? 'Não foi possível entrar.');
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Erro no Google', error?.message ?? 'Não foi possível autenticar com Google.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {backendMode === 'supabase' ? (
          <>
            <Text style={styles.title}>Entrar</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="seu@email.com"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={handleSupabaseLogin}
            >
              <Text style={styles.buttonLabel}>Acessar</Text>
            </Pressable>
            {/* @TODO : No futuro permitir login social na tela de cadastro, mas por ora vamos focar no email/senha
            {/* {Platform.OS === 'web' ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={handleGoogle}
              >
                <Text style={styles.secondaryButtonLabel}>Entrar com Google</Text>
              </Pressable>
            ) : null} */}
            <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8} style={styles.linkWrap}>
              <Text style={styles.linkLabel}>Esqueci minha senha</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8} style={styles.linkWrap}>
              <Text style={styles.linkLabel}>Criar conta</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Escolha o perfil</Text>
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
