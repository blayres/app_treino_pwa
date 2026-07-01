import React, { useEffect, useState, useCallback } from 'react';
import { Text, View } from 'react-native';
import { styles } from './Timer.styles';

type Props = {
  startedAt: string; // ISO string
  capSeconds?: number;
};

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getElapsed(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
}

/**
 * Self-contained timer that owns its own interval.
 * Re-syncs on tab visibility change so it stays accurate after the PWA
 * is resumed from background (Spotify, etc.).
 */
export function LiveTimer({ startedAt, capSeconds }: Props) {
  const [seconds, setSeconds] = useState(() => getElapsed(startedAt));

  const sync = useCallback(() => {
    const elapsed = getElapsed(startedAt);
    setSeconds(capSeconds != null ? Math.min(elapsed, capSeconds) : elapsed);
  }, [startedAt, capSeconds]);

  useEffect(() => {
    // Sync immediately when startedAt changes
    sync();

    const interval = setInterval(sync, 1000);

    // Re-sync when the user returns to the tab after backgrounding
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [sync]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Duração do treino</Text>
      <Text style={styles.time}>{formatDuration(seconds)}</Text>
    </View>
  );
}
