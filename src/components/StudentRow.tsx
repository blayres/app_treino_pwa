import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import type { Translations } from '../i18n/translations';
import { colors, spacing } from '../theme';
import { calendarDaysBetween } from '../utils/date';
import { studentStatus, type StudentStatus, type StudentSummary } from '../services/coachService';
import { Skeleton } from './Skeleton';
import { InitialAvatar } from './InitialAvatar';

const DOT: Record<StudentStatus, string> = {
  noProgram: colors.warning,
  neverTrained: colors.borderSoftLight,
  active: colors.success,
  slipping: colors.warning,
  inactive: colors.danger,
};

/** One-line status the coach reads in the list ("Treinou há 2 dias · 3 treinos na semana"). */
export function studentStatusLabel(student: StudentSummary, now: Date, t: Translations): string {
  const status = studentStatus(student, now);
  if (status === 'noProgram') return t.statusNoProgram;
  if (status === 'neverTrained') return t.statusNeverTrained;
  const idle = calendarDaysBetween(new Date(student.lastWorkoutAt as string), now);
  if (status === 'inactive') return t.statusStopped(idle);
  const last = idle <= 0 ? t.statusTrainedToday : t.statusTrainedDays(idle);
  return status === 'active' ? `${last} · ${t.statusWeek(student.sessionsLast7)}` : last;
}

type Props = { student: StudentSummary; now: Date; onPress: (student: StudentSummary) => void };

export const StudentRow = memo(function StudentRow({ student, now, onPress }: Props) {
  const { t } = useI18n();
  const status = studentStatus(student, now);
  const label = studentStatusLabel(student, now, t);
  return (
    <Pressable
      onPress={() => onPress(student)}
      accessibilityRole="button"
      accessibilityLabel={`${student.name}, ${label}`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        hovered && styles.hovered,
        pressed && styles.pressed,
      ]}
    >
      <InitialAvatar name={student.name} size={40} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{student.name}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: DOT[status] }]} />
          <Text style={styles.status} numberOfLines={1}>{label}</Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
});

/** Placeholder with the same size as a StudentRow (avatar, name, status). */
export function StudentRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={40} height={40} style={{ borderRadius: 20 }} />
      <View style={styles.body}>
        <Skeleton width="55%" height={16} />
        <Skeleton width="75%" height={13} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: 12,
  },
  hovered: { backgroundColor: colors.surfaceMutedLight },
  pressed: { opacity: 0.7 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { flex: 1, fontSize: 13, color: colors.textSecondary },
  chevron: { fontSize: 22, color: colors.textSecondary },
});
