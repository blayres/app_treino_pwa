import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

type IconProps = { size?: number; color?: string };

type Props = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Thin stroke icon before the label (e.g. PlayCircleIcon, SwapIcon). */
  icon?: React.ComponentType<IconProps>;
  /** Makes it a toggle: true = open (filled olive), the label stays the same. */
  active?: boolean;
};

/** Small secondary action under an exercise ("Como fazer", "Alternativas"). */
export function PillButton({ label, onPress, accessibilityLabel, icon: Icon, active }: Props) {
  const color = active ? colors.surfaceLight : colors.olive;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-expanded={active}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, active && styles.active, pressed && styles.pressed]}
    >
      {Icon ? <Icon size={15} color={color} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    marginTop: spacing.xs,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  active: { backgroundColor: colors.olive, borderColor: colors.olive },
  pressed: { opacity: 0.7 },
  label: { fontSize: 12, fontWeight: '600' },
});
