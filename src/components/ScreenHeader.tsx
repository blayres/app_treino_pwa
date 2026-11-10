import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, spacing, typography } from '../theme';

type Props = {
  /** Shows "Voltar" when given. */
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  /** Optional element at the right of the "Voltar" row (e.g. SwitchViewButton). */
  action?: React.ReactNode;
};

/** "Voltar" + page title + subtitle, identical on every screen. */
export function ScreenHeader({ onBack, title, subtitle, action }: Props) {
  const { t } = useI18n();
  const back = onBack ? (
    <Pressable onPress={onBack} hitSlop={16} accessibilityRole="button" style={!action && styles.back}>
      <Text style={styles.backLabel}>{t.back}</Text>
    </Pressable>
  ) : null;
  return (
    <>
      {action ? (
        <View style={styles.backRow}>
          {back ?? <View />}
          {action}
        </View>
      ) : (
        back
      )}
      {title ? (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  backLabel: { ...typography.caption, color: colors.olive },
  title: { ...typography.h2, color: colors.oliveDark },
  subtitle: { ...typography.body, marginTop: spacing.xs, marginBottom: spacing.xl },
});
