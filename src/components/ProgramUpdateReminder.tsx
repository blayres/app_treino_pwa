import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { cardSurface, colors, spacing, typography } from '../theme';
import { getProgramReminder, restartProgramCycle, snoozeProgramReminder } from '../services/programReminder';

type Props = {
  userId: number;
  /** Changes when Home refreshes (e.g. after finishing a workout). */
  refreshKey?: number;
  onUpdate: () => void;
};

/**
 * Home card shown after 2 months with ≥14 trained days each (see
 * services/programReminder). "Atualizar treino" opens Meu treino (saving there
 * restarts the cycle), "Já atualizei" restarts it now, "Lembrar depois" snoozes.
 */
export function ProgramUpdateReminder({ userId, refreshKey, onUpdate }: Props) {
  const { t } = useI18n();
  const [due, setDue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProgramReminder(userId)
      .then((result) => !cancelled && setDue(Boolean(result?.due)))
      .catch(() => {}); // non-critical: never block Home
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  if (!due) return null;

  const dismiss = (action: (id: number) => Promise<void>) => {
    setDue(false);
    action(userId).catch(() => {});
  };

  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.title}>{t.programReminderTitle}</Text>
      <Text style={styles.message}>{t.programReminderMsg}</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onUpdate}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>{t.programReminderUpdate}</Text>
        </Pressable>
        <View style={styles.links}>
          <Pressable onPress={() => dismiss(restartProgramCycle)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{t.programReminderDone}</Text>
          </Pressable>
          <Pressable onPress={() => dismiss(snoozeProgramReminder)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{t.programReminderLater}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardSurface,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.olive,
  },
  title: { ...typography.h3, color: colors.oliveDark },
  message: { ...typography.body, marginTop: spacing.xs, lineHeight: 20 },
  actions: { marginTop: spacing.md, gap: spacing.md },
  primary: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.olive,
  },
  pressed: { opacity: 0.85 },
  primaryLabel: { color: colors.textPrimaryDark, fontWeight: '600', textAlign: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  link: { ...typography.body, color: colors.olive, fontWeight: '600' },
});
