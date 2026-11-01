import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, shadows, spacing, typography } from '../theme';
import { availableSteps, nextAvailableStep, TOURS } from '../services/tours';
import { getTourTarget, hasTourTarget, useTourStore } from '../store/useTourStore';

type Rect = { x: number; y: number; width: number; height: number };

const PAD = 6;
const GAP = 12;
const TIP_WIDTH = 320;
/** Rough tooltip height used to decide above/below before it is measured. */
const TIP_HEIGHT = 170;
/** Targets taller than this share of the screen are highlighted from the top only. */
const MAX_HOLE_SHARE = 0.45;

/** Brings the target into view (web) and measures it in window coordinates. */
function measureTarget(id: string, screenHeight: number): Promise<Rect | null> {
  const node = getTourTarget(id);
  if (!node) return Promise.resolve(null);
  if (Platform.OS === 'web' && typeof node.scrollIntoView === 'function') {
    // Tall targets (e.g. the week's workouts): show their top, the bubble goes below.
    const tall = (node.getBoundingClientRect?.().height ?? 0) > screenHeight * MAX_HOLE_SHARE;
    if (node.style) node.style.scrollMarginTop = '24px';
    node.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'smooth' });
  }
  const measure = () =>
    new Promise<Rect | null>((resolve) => {
      if (typeof node.measureInWindow !== 'function') return resolve(null);
      node.measureInWindow((x: number, y: number, width: number, height: number) =>
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null),
      );
    });
  // Smooth scrolling takes a variable time: wait until the position settles.
  return (async () => {
    let last: Rect | null = null;
    for (let tries = 0; tries < 12; tries += 1) {
      await new Promise((r) => setTimeout(r, tries === 0 ? 150 : 100));
      const current = await measure();
      if (!current) return null;
      if (last && Math.abs(last.y - current.y) < 1) return current;
      last = current;
    }
    return last;
  })();
}

/**
 * Spotlight tour over the real screen: dims everything except the current
 * target and explains it in a bubble ("Pular" / "Próximo"). Rendered once in
 * App; screens start a tour with useTourStore().startIfNew(tour).
 */
export function GuidedTour() {
  const { t } = useI18n();
  const active = useTourStore((s) => s.active);
  const finish = useTourStore((s) => s.finish);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [index, setIndex] = useState(-1);
  const [rect, setRect] = useState<Rect | null>(null);
  // Read in goTo without restarting the tour when the window resizes.
  const screenHRef = useRef(screenH);
  screenHRef.current = screenH;

  const steps = active ? TOURS[active] : [];

  const goTo = useCallback(
    async (from: number) => {
      if (!active) return;
      const next = nextAvailableStep(TOURS[active], from, hasTourTarget);
      if (next < 0) {
        finish();
        return;
      }
      setRect(null);
      setIndex(next);
      const measured = await measureTarget(TOURS[active][next].target, screenHRef.current);
      if (measured) setRect(measured);
      else void goTo(next + 1); // vanished meanwhile
    },
    [active, finish],
  );

  useEffect(() => {
    setIndex(-1);
    setRect(null);
    if (active) void goTo(0);
  }, [active, goTo]);

  if (!active || index < 0) return null;

  const step = steps[index];
  const shown = availableSteps(steps, hasTourTarget);
  const position = Math.max(1, shown.indexOf(index) + 1);
  const isLast = nextAvailableStep(steps, index + 1, hasTourTarget) < 0;

  const hole = rect && {
    left: Math.max(0, rect.x - PAD),
    top: Math.max(0, rect.y - PAD),
    width: Math.min(screenW, rect.width + PAD * 2),
    height: Math.min(rect.height + PAD * 2, screenH * MAX_HOLE_SHARE),
  };
  const tipWidth = Math.min(TIP_WIDTH, screenW - spacing.md * 2);
  const below = hole ? hole.top + hole.height + GAP + TIP_HEIGHT < screenH : true;
  const tipLeft = hole
    ? Math.min(Math.max(spacing.md, hole.left + hole.width / 2 - tipWidth / 2), screenW - tipWidth - spacing.md)
    : (screenW - tipWidth) / 2;
  const tipPosition = hole
    ? below
      ? { top: hole.top + hole.height + GAP }
      : { bottom: screenH - hole.top + GAP }
    : { top: screenH / 3 };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        {hole ? (
          <>
            <View style={[styles.dim, { left: 0, top: 0, right: 0, height: hole.top }]} />
            <View style={[styles.dim, { left: 0, top: hole.top + hole.height, right: 0, bottom: 0 }]} />
            <View style={[styles.dim, { left: 0, top: hole.top, width: hole.left, height: hole.height }]} />
            <View
              style={[styles.dim, { left: hole.left + hole.width, top: hole.top, right: 0, height: hole.height }]}
            />
            <View style={[styles.ring, hole]} />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        {rect && (
          <View style={[styles.tip, { width: tipWidth, left: tipLeft }, tipPosition]} accessibilityLiveRegion="polite">
            <Text style={styles.counter}>{t.tourStep(position, shown.length)}</Text>
            <Text style={styles.title} accessibilityRole="header">{t[step.title]}</Text>
            <Text style={styles.text}>{t[step.text]}</Text>
            <View style={styles.actions}>
              <Pressable onPress={finish} accessibilityRole="button" hitSlop={8} style={styles.skip}>
                <Text style={styles.skipLabel}>{t.tourSkip}</Text>
              </Pressable>
              <Pressable
                onPress={() => (isLast ? finish() : void goTo(index + 1))}
                accessibilityRole="button"
                style={({ pressed }) => [styles.next, pressed && styles.pressed]}
              >
                <Text style={styles.nextLabel}>{isLast ? t.tourDone : t.tourNext}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(16, 17, 15, 0.62)' },
  ring: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.accent,
    pointerEvents: 'none',
  },
  tip: {
    position: 'absolute',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    padding: spacing.lg,
    ...shadows.popover,
  },
  counter: { ...typography.caption, color: colors.olive, fontWeight: '600', marginBottom: spacing.xs },
  title: { ...typography.h3, marginBottom: spacing.xs },
  text: { ...typography.body, color: colors.textPrimary, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  skip: { paddingVertical: spacing.sm, paddingRight: spacing.md },
  skipLabel: { fontSize: 14, color: colors.textSecondary },
  next: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  nextLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimaryDark },
});
