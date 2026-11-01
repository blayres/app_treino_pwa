import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows, spacing, typography } from '../theme';

type Props = {
  title: string;
  description: string;
  onPress: () => void;
  /** Optional leading icon (e.g. an inline SVG). */
  icon?: React.ReactNode;
  /** Recommended option: olive border + filled icon. */
  highlight?: boolean;
  /** Small pill next to the title ("Mais rápido", "Em breve"). */
  badge?: string;
  /** Shown but not clickable (e.g. "Em breve"). */
  disabled?: boolean;
};

/** Big tappable choice card (onboarding options, "Trocar meu treino"). */
export function OptionCard({ title, description, onPress, icon, highlight = false, badge, disabled = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.card,
        highlight && styles.highlight,
        hovered && !highlight && !disabled && styles.hovered,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon ? <View style={[styles.icon, highlight && styles.iconHighlight]}>{icon}</View> : null}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge ? (
            <View style={[styles.badge, disabled && styles.badgeMuted]}>
              <Text style={[styles.badgeText, disabled && styles.badgeTextMuted]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.description}>{description}</Text>
      </View>
      {!disabled && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  highlight: { borderColor: colors.olive },
  hovered: { borderColor: colors.olive + '66' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55, boxShadow: 'none' },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.olive + '14',
  },
  iconHighlight: { backgroundColor: colors.olive },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  description: { ...typography.body, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.accentSoft },
  badgeMuted: { backgroundColor: colors.surfaceMutedLight },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.oliveDark, letterSpacing: 0.3 },
  badgeTextMuted: { color: colors.textSecondary },
  chevron: { fontSize: 22, color: colors.textSecondary },
});
