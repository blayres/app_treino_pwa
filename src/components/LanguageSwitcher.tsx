import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n, type Locale } from '../i18n';
import { colors, spacing } from '../theme';

const OPTIONS: Locale[] = ['pt', 'en', 'es', 'fr'];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);

  const handleSelect = (value: Locale) => {
    setLocale(value);
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      {open ? <Pressable style={styles.backdrop} onPress={() => setOpen(false)} /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Language: ${t.localeLabels[locale]}`}
        accessibilityHint="Opens language options"
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Text style={styles.triggerText}>{t.localeLabels[locale]}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      {open ? (
        <View style={styles.menu}>
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              accessibilityRole="menuitem"
              onPress={() => handleSelect(opt)}
              style={[styles.option, locale === opt && styles.optionActive]}
            >
              <Text style={[styles.optionLabel, locale === opt && styles.optionLabelActive]}>
                {t.localeLabels[opt]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
    zIndex: 1000,
    overflow: 'visible',
  },
  backdrop: {
    position: 'absolute',
    top: -200,
    left: -200,
    right: -200,
    bottom: -200,
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: colors.surfaceMutedLight,
    minWidth: 44,
    justifyContent: 'center',
  },
  triggerPressed: {
    opacity: 0.8,
  },
  triggerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  chevron: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  menu: {
    position: 'absolute',
    top: 34,
    left: 0,
    minWidth: 72,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: colors.surfaceLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 1000,
    zIndex: 1001,
  },
  option: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  optionActive: {
    backgroundColor: colors.olive + '18',
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  optionLabelActive: {
    color: colors.olive,
  },
});
