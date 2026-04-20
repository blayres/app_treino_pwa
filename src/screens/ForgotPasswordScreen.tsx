import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { styles } from './LoginScreen.styles';
import { feedbackStyles } from './FeedbackStyles';
import { sendPasswordReset } from '../services/authService';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Navigation>();
  const [email, setEmail] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleReset = async () => {
    setSuccess('');
    setError('');

    if (!email) {
      setError('Informe seu email.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSuccess('Email enviado! Verifique sua caixa de entrada para redefinir a senha (pode estar no spam).');
    } catch (err: any) {
      const raw = err?.message ?? 'Não foi possível enviar o email de recuperação.';
      setError(`Não entre em pânico e manda esse erro pra Babi: ${raw}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Recuperar senha</Text>
        <Text style={styles.subtitle}>Digite seu email para receber o link de recuperação.</Text>

        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="seu@email.com"
          value={email}
          onChangeText={setEmail}
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
          onPress={handleReset}
          disabled={loading}
        >
          <Text style={styles.buttonLabel}>{loading ? 'Enviando...' : 'Enviar link'}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.linkWrap}>
          <Text style={styles.linkLabel}>Voltar para login</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
