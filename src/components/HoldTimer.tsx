import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { StopwatchIcon } from './StopwatchIcon';
import { useI18n } from '../i18n';
import { colors, minTouchSize, spacing } from '../theme';
import { formatClock, formatSeconds } from '../utils/measure';

type Props = {
  /** Hold time to count down, in seconds. */
  seconds: number;
  exerciseName: string;
};

/** "Done" stays on screen this long before the pill resets. */
const DONE_MS = 3000;

function vibrate() {
  try {
    if (Platform.OS === 'web') (globalThis.navigator as Navigator | undefined)?.vibrate?.([200, 100, 200]);
    else Vibration.vibrate([0, 200, 100, 200]);
  } catch {
    // Not supported (iOS Safari): the "Pronto" label is enough.
  }
}

/**
 * Countdown for a timed exercise (plank…), shown where load exercises have the
 * load inputs: tap to start, tap again to stop. Vibrates at the end where the
 * device allows it.
 */
export function HoldTimer({ seconds, exerciseName }: Props) {
  const { t } = useI18n();
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(seconds);
  const [done, setDone] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (endsAt == null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        setEndsAt(null);
        setDone(true);
        vibrate();
        doneTimer.current = setTimeout(() => setDone(false), DONE_MS);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  useEffect(() => () => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
  }, []);

  const running = endsAt != null;
  // Typing a new time while idle updates what the next start counts down.
  useEffect(() => {
    if (endsAt == null) setLeft(seconds);
  }, [seconds, endsAt]);
  const toggle = () => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
    setDone(false);
    if (running) {
      setEndsAt(null);
      setLeft(seconds);
    } else {
      setLeft(seconds);
      setEndsAt(Date.now() + seconds * 1000);
    }
  };

  const time = formatSeconds(seconds, t.minuteShort, t.secondShort);
  const active = running || done;
  const accessibilityLabel = running
    ? t.timerStop(exerciseName)
    : done
      ? `${t.timerDone} · ${exerciseName}`
      : t.timerStart(exerciseName, time);

  // Same size as the "Tempo (s)" input above it: only the stopwatch when idle,
  // the time left ("0:27") while it runs. The tap area is 40px (hitSlop does
  // nothing on the web).
  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.touchArea}>
      {({ pressed }) => (
        <View style={[styles.timer, active && styles.timerActive, pressed && styles.pressed]}>
          {running ? (
            <Text style={styles.label}>{formatClock(left)}</Text>
          ) : (
            <StopwatchIcon size={18} color={active ? colors.surfaceLight : colors.olive} />
          )}
        </View>
      )}
    </Pressable>
  );
}

// Matches WorkoutScreen.styles loadInput (64 × 29px on the web, pill).
const TIMER_HEIGHT = 29;
const EXTRA = (minTouchSize - TIMER_HEIGHT) / 2;

const styles = StyleSheet.create({
  touchArea: {
    minHeight: minTouchSize,
    justifyContent: 'center',
    marginTop: spacing.xs - EXTRA,
    marginBottom: -EXTRA,
  },
  timer: {
    width: 64,
    height: TIMER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  timerActive: { backgroundColor: colors.olive, borderColor: colors.olive },
  pressed: { opacity: 0.7 },
  label: { fontSize: 16, fontWeight: '600', color: colors.surfaceLight, fontVariant: ['tabular-nums'] },
});
