import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { styles } from './LoginScreen.styles';
import { feedbackStyles } from './FeedbackStyles';
import { signUpWithEmail } from '../services/authService';
import { useI18n } from '../i18n';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

export default function SignupScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useI18n();
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
      setError(t.signupDefaultError);
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, name.trim() || undefined);
      setSuccess(t.signupSuccess);
    } catch (err: any) {
      const raw = err?.message ?? t.signupDefaultError;
      setError(t.signupError(raw));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t.createAccountTitle}</Text>
        <Text style={styles.subtitle}>{t.createAccountSubtitle}</Text>

        <TextInput
          style={styles.input}
          autoCapitalize="words"
          placeholder={t.namePlaceholder}
          value={name}
          onChangeText={setName}
        />
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
          <Text style={styles.buttonLabel}>{loading ? t.creating : t.createAccountTitle}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.linkWrap}>
          <Text style={styles.linkLabel}>{t.alreadyHaveAccount}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
