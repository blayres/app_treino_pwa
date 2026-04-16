import React from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { styles } from './LoginScreen.styles';
import { sendPasswordReset } from '../services/authService';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Navigation>();
  const [email, setEmail] = React.useState('');

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Campo obrigatório', 'Informe seu email.');
      return;
    }

    try {
      await sendPasswordReset(email.trim());
      Alert.alert(
        'Email enviado',
        'Enviamos instruções para redefinir sua senha. Confira sua caixa de entrada.',
      );
      navigation.navigate('Login');
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível enviar o email de recuperação.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
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
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, styles.mt]}
          onPress={handleReset}
        >
          <Text style={styles.buttonLabel}>Enviar link</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.linkWrap}>
          <Text style={styles.linkLabel}>Voltar para login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
