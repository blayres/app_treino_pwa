import React from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { styles } from './LoginScreen.styles';
import { signInWithGoogle, signUpWithEmail } from '../services/authService';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

export default function SignupScreen() {
  const navigation = useNavigation<Navigation>();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Campos obrigatórios', 'Preencha email e senha.');
      return;
    }

    try {
      await signUpWithEmail(email.trim(), password, name.trim() || undefined);
      Alert.alert(
        'Conta criada',
        'Conta criada com sucesso. Se a confirmação por email estiver ativa no Supabase, verifique sua caixa de entrada.',
      );
      navigation.navigate('Login');
    } catch (error: any) {
      Alert.alert('Erro no cadastro', error?.message ?? 'Não foi possível criar a conta.');
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Erro no Google', error?.message ?? 'Falha ao autenticar com Google.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>Use email e senha para começar.</Text>

        <TextInput
          style={styles.input}
          autoCapitalize="words"
          placeholder="Nome"
          value={name}
          onChangeText={setName}
        />
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
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, styles.mt]}
          onPress={handleSignUp}
        >
          <Text style={styles.buttonLabel}>Criar conta</Text>
        </Pressable>

        {/* @TODO : No futuro permitir login social na tela de cadastro, mas por ora vamos focar no email/senha */}
        {/* {Platform.OS === 'web' ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={handleGoogle}
          >
            <Text style={styles.secondaryButtonLabel}>Continuar com Google</Text>
          </Pressable>
        ) : null} */}

        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.linkWrap}>
          <Text style={styles.linkLabel}>Já tenho conta</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
