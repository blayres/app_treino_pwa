import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { styles } from './LoginScreen.styles';
import { feedbackStyles } from './FeedbackStyles';
import { sendPasswordReset } from '../services/authService';
import { useI18n } from '../i18n';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useI18n();
  const [email, setEmail] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleReset = async () => {
    setSuccess('');
    setError('');

    if (!email) {
      setError(t.emailRequired);
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSuccess(t.resetSuccess);
    } catch (err: any) {
      const raw = err?.message ?? t.resetDefaultError;
      setError(t.resetError(raw));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t.recoverPassword}</Text>
        <Text style={styles.subtitle}>{t.recoverPasswordSubtitle}</Text>

        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={t.emailPlaceholder}
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
          <Text style={styles.buttonLabel}>{loading ? t.sending : t.sendLink}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.linkWrap}>
          <Text style={styles.linkLabel}>{t.backToLogin}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
