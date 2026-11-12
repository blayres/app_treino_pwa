import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, minTouchSize, spacing } from '../theme';

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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.touchArea}
    >
      {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
        <View style={[styles.pill, hovered && styles.hovered, pressed && styles.pressed]}>
          {icon}
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const PILL_HEIGHT = 36;
const EXTRA = Math.max(0, (minTouchSize - PILL_HEIGHT) / 2);

const styles = StyleSheet.create({
  // Invisible tap area of at least 40px; negative margins keep the pill's layout.
  touchArea: { justifyContent: 'center', minHeight: minTouchSize, marginVertical: -EXTRA },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: PILL_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.olive + '55',
  },
  hovered: { backgroundColor: colors.olive + '14' },
  pressed: { backgroundColor: colors.olive + '24' },
  label: { fontSize: 14, fontWeight: '600', color: colors.olive },
});
