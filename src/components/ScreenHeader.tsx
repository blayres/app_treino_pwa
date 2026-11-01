import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useI18n } from '../i18n';
import { colors, spacing, typography } from '../theme';

type Props = {
  /** Shows "Voltar" when given. */
  onBack?: () => void;
  title?: string;
  subtitle?: string;
};

/** "Voltar" + page title + subtitle, identical on every screen. */
export function ScreenHeader({ onBack, title, subtitle }: Props) {
  const { t } = useI18n();
  return (
    <>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={16} accessibilityRole="button" style={styles.back}>
          <Text style={styles.backLabel}>{t.back}</Text>
        </Pressable>
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
  backLabel: { ...typography.caption, color: colors.olive },
  title: { ...typography.h2, color: colors.oliveDark },
  subtitle: { ...typography.body, marginTop: spacing.xs, marginBottom: spacing.xl },
});
