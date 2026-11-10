import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';

/** Placeholder for the workout's exercise list (same rhythm as ExerciseRow). */
export function WorkoutExercisesSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ paddingHorizontal: 12 }}>
      {[...Array(rows)].map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 35, marginTop: 30 }}>
          <Skeleton width={22} height={22} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
            <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Skeleton width={60} height={32} style={{ marginBottom: 6 }} />
            <Skeleton width={60} height={32} />
          </View>
        </View>
      ))}
    </View>
  );
}
