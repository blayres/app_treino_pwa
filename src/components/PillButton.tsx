import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

/** Small secondary action under an exercise ("Ver animação", "Ver substitutos"). */
export function PillButton({ label, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: 11, color: colors.olive, fontWeight: '500' },
});
