import React from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { spacing } from '../theme';
import { styles } from '../screens/Coach.styles';
import { SectionCard } from './SectionCard';
import { Skeleton } from './Skeleton';

/** Weekly program rows while they load (student page). */
export function ProgramDaysSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.dayRow}>
          <Skeleton width={56} height={12} />
          <View style={styles.dayBody}>
            <Skeleton width="70%" height={15} />
            <Skeleton width="35%" height={12} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </>
  );
}

/**
 * Student page before the student is known: same layout as the real page
 * (avatar + name, the three stat tiles with their labels, weekly program).
 */
export function CoachStudentSkeleton() {
  const { t } = useI18n();
  return (
    <>
      <View style={styles.profileRow}>
        <Skeleton width={52} height={52} style={{ borderRadius: 26 }} />
        <View style={styles.profileText}>
          <Skeleton width="55%" height={22} />
          <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
      <View style={styles.stats}>
        {[t.statLast7, t.statLast30, t.statLastWorkout].map((label) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
            <Skeleton width="70%" height={20} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      <SectionCard title={t.studentProgram}>
        <ProgramDaysSkeleton />
      </SectionCard>
    </>
  );
}
