import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration } from 'react-native';
import { StopwatchIcon } from './StopwatchIcon';
import { useI18n } from '../i18n';
import { colors, spacing } from '../theme';
import { formatSeconds } from '../utils/measure';

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

  // Idle: "Iniciar" (the time is in the input above); running: what's left.
  const label = done ? t.timerDone : running ? formatSeconds(left, t.minuteShort, t.secondShort) : t.timerStartShort;
  const time = formatSeconds(seconds, t.minuteShort, t.secondShort);

  const active = running || done;
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={running ? t.timerStop(exerciseName) : t.timerStart(exerciseName, time)}
      hitSlop={6}
      style={({ pressed }) => [styles.timer, active && styles.timerActive, pressed && styles.pressed]}
    >
      <StopwatchIcon size={16} color={active ? colors.surfaceLight : colors.olive} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Same pill as the load inputs it replaces (WorkoutScreen.styles loadInput).
  timer: {
    marginTop: spacing.xs,
    minWidth: 64,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  timerActive: { backgroundColor: colors.olive, borderColor: colors.olive },
  pressed: { opacity: 0.7 },
  label: { fontSize: 16, fontWeight: '600', color: colors.olive, fontVariant: ['tabular-nums'] },
  labelActive: { color: colors.surfaceLight },
});
