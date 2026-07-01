import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useI18n, type Locale } from '../i18n';
import { colors, spacing } from '../theme';

const OPTIONS: Locale[] = ['pt', 'en', 'es', 'fr'];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => setLocale(opt)}
          style={[styles.btn, locale === opt && styles.btnActive]}
        >
          <Text style={[styles.label, locale === opt && styles.labelActive]}>
            {t.localeLabels[opt]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  btn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: 'transparent',
  },
  btnActive: {
    borderColor: colors.olive,
    backgroundColor: colors.olive + '18',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.olive,
  },
});
