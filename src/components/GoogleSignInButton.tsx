import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { useI18n } from '../i18n';

// Minimal inline Google 'G' logo — no external image dependency
function GoogleIcon() {
  return (
    <View style={icon.wrapper} accessibilityElementsHidden>
      <Text style={icon.letter}>G</Text>
    </View>
  );
}

const icon = StyleSheet.create({
  wrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  letter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4285F4',
    lineHeight: 17,
    includeFontPadding: false,
  },
});

type Props = {
  onPress: () => void;
  disabled?: boolean;
};

export function GoogleSignInButton({ onPress, disabled }: Props) {
  const { t } = useI18n();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t.continueWithGoogle}
    >
      <GoogleIcon />
      <Text style={styles.label}>{t.continueWithGoogle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
