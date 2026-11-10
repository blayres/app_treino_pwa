import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
};

/**
 * Outlined pill that switches between the trainer's two sides: "Alunos" on
 * Home → trainer area, "Meu treino" in the trainer area → Home.
 */
export function SwitchViewButton({ label, icon, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.pill,
        hovered && styles.hovered,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.olive + '55',
  },
  hovered: { backgroundColor: colors.olive + '14' },
  pressed: { backgroundColor: colors.olive + '24' },
  label: { fontSize: 14, fontWeight: '600', color: colors.olive },
});
