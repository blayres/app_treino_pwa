import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { styles } from './LoginScreen.styles';
import { feedbackStyles } from './FeedbackStyles';
import { sendPasswordReset } from '../services/authService';
import { useI18n } from '../i18n';
import { mapAuthError } from '../services/authErrorMapper';
import { LogoBar } from '../components/LogoBar';

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
      setError(mapAuthError(err?.message, t, t.resetDefaultError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <LogoBar />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t.recoverPassword}</Text>
        <Text style={styles.subtitle}>{t.recoverPasswordSubtitle}</Text>

        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          accessibilityLabel={t.emailPlaceholder}
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
          aria-busy={loading}
          accessibilityRole="button"
        >
          {/* Same label while sending (CLAUDE.md): disabled + faded instead. */}
          <Text style={styles.buttonLabel}>{t.sendLink}</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Login')}
          hitSlop={8}
          style={styles.linkWrap}
          accessibilityRole="link"
        >
          <Text style={styles.linkLabel}>{t.backToLogin}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
