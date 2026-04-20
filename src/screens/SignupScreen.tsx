import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { styles } from './LoginScreen.styles';
import { feedbackStyles } from './FeedbackStyles';
import { signUpWithEmail } from '../services/authService';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

export default function SignupScreen() {
  const navigation = useNavigation<Navigation>();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSignUp = async () => {
    setSuccess('');
    setError('');

    if (!email || !password) {
      setError('Preencha email e senha.');
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, name.trim() || undefined);
      setSuccess('Conta criada com sucesso! Verifique seu email para continuar (pode estar no spam).');
    } catch (err: any) {
      const raw = err?.message ?? 'Não foi possível criar a conta.';
      setError(`Não entre em pânico e manda esse erro pra Babi: ${raw}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, styles.mt, loading && { opacity: 0.6 }]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.buttonLabel}>{loading ? 'Criando...' : 'Criar conta'}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.linkWrap}>
          <Text style={styles.linkLabel}>Já tenho conta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
