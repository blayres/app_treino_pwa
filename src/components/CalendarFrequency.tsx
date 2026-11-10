import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { styles } from './CalendarFrequency.styles';
import { typography } from '../theme';
import { getAttendanceDatesByMonth, getCachedAttendanceMonth } from '../services/attendanceService';
import { useI18n } from '../i18n';
import { buildMonthWeeks } from '../utils/date';

type Props = {
  userId: number;
  /** Called with the month's check-ins once they are known. */
  onLoad?: (checkInCount: number, totalDays: number) => void;
};

/**
 * Month calendar with the days the user trained. The month name, weekday
 * headers and day grid are drawn immediately (no network needed); only the
 * check-ins come from the database, from cache first when available.
 */
export const CalendarFrequency = forwardRef<{ refresh: () => void }, Props>(({ userId, onLoad }, ref) => {
  const { t } = useI18n();
  const [offset, setOffset] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const today = new Date();
  const displayDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const [checkIns, setCheckIns] = useState<{ key: string; dates: Set<string> } | null>(() => {
    const cached = getCachedAttendanceMonth({ userId, year, month });
    return cached ? { key: `${userId}:${year}:${month}`, dates: cached.dates } : null;
  });

  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  // Cached month: applied before paint, so the count and checks show on the first frame.
  useLayoutEffect(() => {
    const cached = getCachedAttendanceMonth({ userId, year, month });
    if (!cached) return;
    setCheckIns({ key: `${userId}:${year}:${month}`, dates: cached.dates });
    onLoadRef.current?.(cached.dates.size, cached.totalDays);
  }, [userId, year, month]);

  useEffect(() => {
    let cancelled = false;
    const key = `${userId}:${year}:${month}`;
    getAttendanceDatesByMonth({ userId, year, month })
      .then((result) => {
        if (cancelled) return;
        setCheckIns({ key, dates: result.dates });
        onLoadRef.current?.(result.dates.size, result.totalDays);
      })
      .catch((err) => console.warn('Falha ao carregar frequência:', err));
    return () => {
      cancelled = true;
    };
  }, [userId, year, month, reloadKey]);

  useImperativeHandle(ref, () => ({ refresh: () => setReloadKey((k) => k + 1) }), []);

  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month]);
  // Check-ins of another month (while switching) are not shown on this one.
  const dates = checkIns?.key === `${userId}:${year}:${month}` ? checkIns.dates : null;
  const isCurrentMonth = offset === 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setOffset((o) => o - 1)} accessibilityRole="button" accessibilityLabel="‹">
          <Text style={{ fontSize: 25 }}>‹</Text>
        </Pressable>

        <Text style={typography.caption}>
          {t.months[month]}
          {year !== today.getFullYear() ? ` ${year}` : ''}
        </Text>

        <Pressable
          onPress={() => setOffset((o) => o + 1)}
          disabled={isCurrentMonth}
          accessibilityRole="button"
          accessibilityLabel="›"
        >
          <Text style={{ fontSize: 25, opacity: isCurrentMonth ? 0.2 : 1 }}>›</Text>
        </Pressable>
      </View>

      <View style={styles.calendarContainer}>
        <View style={styles.weekRow}>
          {t.dayHeaders.map((h, i) => (
            <View key={i} style={styles.dayHeader}>
              <Text style={styles.dayHeaderLabel}>{h}</Text>
            </View>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, di) => (
              <View key={di} style={styles.dayCell}>
                {!day.isEmpty && (
                  <View style={[styles.day, dates?.has(day.date) && styles.dayActive]}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
});

CalendarFrequency.displayName = 'CalendarFrequency';
