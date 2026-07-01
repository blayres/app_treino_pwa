import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useI18n, type Locale } from '../i18n';
import { colors, spacing } from '../theme';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'pt', label: 'PT' },
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
  { value: 'fr', label: 'FR' },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => setLocale(opt.value)}
          style={[styles.btn, locale === opt.value && styles.btnActive]}
        >
          <Text style={[styles.label, locale === opt.value && styles.labelActive]}>
            {opt.label}
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
