import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { useI18n } from '../i18n';

export function OrDivider() {
  const { t } = useI18n();

  return (
    <View style={styles.row} accessibilityElementsHidden>
      <View style={styles.line} />
      <Text style={styles.label}>{t.orDivider}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSoftLight,
  },
  label: {
    marginHorizontal: spacing.md,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
