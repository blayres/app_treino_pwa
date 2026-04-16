import React, {
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useRef,
} from 'react';
import { View, Text, Pressable } from 'react-native';
import { styles } from './CalendarFrequency.styles';
import { typography } from '../theme';
import { getAttendanceDatesByMonth } from '../services/attendanceService';
import { Skeleton } from './Skeleton';

type Props = {
  userId: number;
  onLoad?: (checkInCount: number, totalDays: number) => void;
};

type DayItem = {
  date: string;
  label: string;
  dayOfWeek: number;
  hasCheckIn: boolean;
  isEmpty: boolean;
};

type WeekRow = DayItem[];

export const CalendarFrequency = forwardRef<{ refresh: () => void }, Props>(
  ({ userId, onLoad }, ref) => {
    const [weeks, setWeeks] = useState<WeekRow[]>([]);
    const [offset, setOffset] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const cacheRef = useRef<Record<string, WeekRow[]>>({});

    const loadCalendar = async (monthOffset: number = offset, force = false) => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + monthOffset;

      const cacheKey = `${userId}-${year}-${month}`;

      if (!force && cacheRef.current[cacheKey]) {
        setWeeks(cacheRef.current[cacheKey]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDay.getDay();

        const tempDays: DayItem[] = [];

        for (let i = 0; i < firstDayOfWeek; i++) {
          tempDays.push({
            date: '',
            label: '',
            dayOfWeek: i,
            hasCheckIn: false,
            isEmpty: true,
          });
        }

        const formatLocalDate = (date: Date): string => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        for (let i = 1; i <= lastDay.getDate(); i++) {
          const d = new Date(year, month, i);
          tempDays.push({
            date: formatLocalDate(d),
            label: i.toString(),
            dayOfWeek: d.getDay(),
            hasCheckIn: false,
            isEmpty: false,
          });
        }

        const lastDayOfWeek = lastDay.getDay();
        for (let i = 0; i < 6 - lastDayOfWeek; i++) {
          tempDays.push({
            date: '',
            label: '',
            dayOfWeek: (lastDayOfWeek + 1 + i) % 7,
            hasCheckIn: false,
            isEmpty: true,
          });
        }

        const attendance = await getAttendanceDatesByMonth({
          userId,
          year,
          month,
        });

        const dates = attendance.dates;

        const daysWithCheckIns = tempDays.map(d => ({
          ...d,
          hasCheckIn: d.date !== '' && dates.has(d.date),
        }));

        const weeksData: WeekRow[] = [];
        for (let i = 0; i < daysWithCheckIns.length; i += 7) {
          weeksData.push(daysWithCheckIns.slice(i, i + 7));
        }

        cacheRef.current[cacheKey] = weeksData;

        setWeeks(weeksData);
        onLoad?.(dates.size, attendance.totalDays);
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      loadCalendar(offset);
    }, [offset]);

    useImperativeHandle(ref, () => ({
      refresh: () => loadCalendar(offset, true),
    }));

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];

    const today = new Date();
    const displayDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const currentMonthLabel = monthNames[displayDate.getMonth()];
    const currentYearLabel = displayDate.getFullYear();
    const isCurrentMonth = offset === 0;

    const dayHeaders = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    if (isLoading) {
      return (
        <View>
          {[...Array(1)].map((_, i) => (
            <View
              key={i}
              style={{
                paddingVertical: 5,
                paddingHorizontal: 0,
                borderRadius: 15,
                marginBottom: 0,
              }}
            >
              <Skeleton width={350} height={280} />
            </View>
          ))}
        </View>
      );
    }

    return (
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Pressable onPress={() => setOffset(o => o - 1)}>
            <Text style={{ fontSize: 18 }}>‹</Text>
          </Pressable>

          <Text style={typography.caption}>
            {currentMonthLabel}
            {currentYearLabel !== today.getFullYear() ? ` ${currentYearLabel}` : ''}
          </Text>

          <Pressable onPress={() => setOffset(o => o + 1)} disabled={isCurrentMonth}>
            <Text style={{ fontSize: 18, opacity: isCurrentMonth ? 0.2 : 1 }}>›</Text>
          </Pressable>
        </View>

        <View style={styles.calendarContainer}>
          <View style={styles.weekRow}>
            {dayHeaders.map((h, i) => (
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
                    <View style={[styles.day, day.hasCheckIn && styles.dayActive]}>
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
  },
);

CalendarFrequency.displayName = 'CalendarFrequency';

