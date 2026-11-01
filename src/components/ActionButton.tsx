import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  /** primary = filled olive; secondary = outlined. */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** Spinner instead of the label (the label itself never changes). */
  loading?: boolean;
  accessibilityLabel?: string;
};

/** Rounded action inside a card ("Ver meu progresso", "Editar treino", "Copiar link"). */
export function ActionButton({ label, onPress, variant = 'primary', disabled = false, loading = false, accessibilityLabel }: Props) {
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.textPrimaryDark : colors.olive} />
      ) : (
        <Text style={[styles.label, primary ? styles.labelPrimary : styles.labelSecondary]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.olive },
  secondary: { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.olive },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 },
  label: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  labelPrimary: { color: colors.textPrimaryDark },
  labelSecondary: { color: colors.olive },
});
