import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { styles } from './CalendarFrequency.styles';
import { getDb } from '../db';
import { typography } from '../theme';

type Props = {
  userId: number;
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
  ({ userId }, ref) => {
    const [weeks, setWeeks] = useState<WeekRow[]>([]);
    const [offset, setOffset] = useState(0);

    const loadCalendar = async (monthOffset: number = offset) => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + monthOffset;

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const firstDayOfWeek = firstDay.getDay();

      const tempDays: DayItem[] = [];

      for (let i = 0; i < firstDayOfWeek; i += 1) {
        tempDays.push({ date: '', label: '', dayOfWeek: i, hasCheckIn: false, isEmpty: true });
      }

      const formatLocalDate = (date: Date): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      for (let i = 1; i <= lastDay.getDate(); i += 1) {
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
      for (let i = 0; i < 6 - lastDayOfWeek; i += 1) {
        tempDays.push({
          date: '',
          label: '',
          dayOfWeek: (lastDayOfWeek + 1 + i) % 7,
          hasCheckIn: false,
          isEmpty: true,
        });
      }

      const from = formatLocalDate(firstDay);
      const to = formatLocalDate(lastDay);
      const db = await getDb();
      const result = await db.getAllAsync<{ date: string }>(
        `SELECT date FROM attendance WHERE user_id = ? AND date BETWEEN ? AND ?;`,
        userId, from, to,
      );
      const dates = new Set(result.map(row => row.date));

      const daysWithCheckIns = tempDays.map(d => ({
        ...d,
        hasCheckIn: d.date !== '' && dates.has(d.date),
      }));

      const weeksData: WeekRow[] = [];
      for (let i = 0; i < daysWithCheckIns.length; i += 7) {
        weeksData.push(daysWithCheckIns.slice(i, i + 7));
      }

      setWeeks(weeksData);
    };

    useEffect(() => {
      loadCalendar(offset);
    }, [userId, offset]);

    useImperativeHandle(ref, () => ({
      refresh: () => loadCalendar(offset),
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

    return (
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Pressable onPress={() => setOffset(o => o - 1)} hitSlop={12}>
            <Text style={{ fontSize: 18, paddingHorizontal: 4 }}>‹</Text>
          </Pressable>

          <Text style={typography.caption}>
            {currentMonthLabel}{currentYearLabel !== today.getFullYear() ? ` ${currentYearLabel}` : ''}
          </Text>

          <Pressable
            onPress={() => setOffset(o => o + 1)}
            hitSlop={12}
            disabled={isCurrentMonth}
          >
            <Text style={{ fontSize: 18, paddingHorizontal: 4, opacity: isCurrentMonth ? 0.2 : 1 }}>›</Text>
          </Pressable>
        </View>

        <View style={styles.calendarContainer}>

          <View style={styles.weekRow}>
            {dayHeaders.map((header, index) => (
              <View key={index} style={styles.dayHeader}>
                <Text style={styles.dayHeaderLabel}>{header}</Text>
              </View>
            ))}
          </View>

          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day, dayIndex) => (
                <View key={`${weekIndex}-${dayIndex}`} style={styles.dayCell}>
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



// import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
// import { View, Text } from 'react-native';
// import { styles } from './CalendarFrequency.styles';
// import { getDb } from '../db';
// import { typography } from '../theme';

// type Props = {
//   userId: number;
// };

// type DayItem = {
//   date: string;
//   label: string;
//   dayOfWeek: number;
//   hasCheckIn: boolean;
//   isEmpty: boolean;
// };

// type WeekRow = DayItem[];

// export const CalendarFrequency = forwardRef<{ refresh: () => void }, Props>(
//   ({ userId }, ref) => {
//     const [weeks, setWeeks] = useState<WeekRow[]>([]);

//     const loadCalendar = async () => {
//       const today = new Date();
//       const year = today.getFullYear();
//       const month = today.getMonth();

//       const firstDay = new Date(year, month, 1);
//       const lastDay = new Date(year, month + 1, 0);
//       const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday

//       const tempDays: DayItem[] = [];

//       // Add empty days before the first day of the month
//       for (let i = 0; i < firstDayOfWeek; i += 1) {
//         tempDays.push({
//           date: '',
//           label: '',
//           dayOfWeek: i,
//           hasCheckIn: false,
//           isEmpty: true,
//         });
//       }

//       // Helper function to format date as YYYY-MM-DD using local timezone
//       const formatLocalDate = (date: Date): string => {
//         const y = date.getFullYear();
//         const m = String(date.getMonth() + 1).padStart(2, '0');
//         const d = String(date.getDate()).padStart(2, '0');
//         return `${y}-${m}-${d}`;
//       };

//       // Add all days of the month
//       for (let i = 1; i <= lastDay.getDate(); i += 1) {
//         const d = new Date(year, month, i);
//         const localDate = formatLocalDate(d);
//         tempDays.push({
//           date: localDate,
//           label: i.toString(),
//           dayOfWeek: d.getDay(),
//           hasCheckIn: false,
//           isEmpty: false,
//         });
//       }

//       // Add empty days after the last day of the month to complete the last week
//       const lastDayOfWeek = lastDay.getDay();
//       const daysToAdd = 6 - lastDayOfWeek;
//       for (let i = 0; i < daysToAdd; i += 1) {
//         tempDays.push({
//           date: '',
//           label: '',
//           dayOfWeek: (lastDayOfWeek + 1 + i) % 7,
//           hasCheckIn: false,
//           isEmpty: true,
//         });
//       }

//       // Load check-ins from database (using local dates)
//       const from = formatLocalDate(firstDay);
//       const to = formatLocalDate(lastDay);
//       const db = await getDb();
//       const result = await db.getAllAsync<{ date: string }>(
//         `SELECT date FROM attendance
//          WHERE user_id = ? AND date BETWEEN ? AND ?;`,
//         userId,
//         from,
//         to,
//       );
//       const dates = new Set(result.map(row => row.date));

//       // Mark days with check-ins
//       const daysWithCheckIns = tempDays.map(d => ({
//         ...d,
//         hasCheckIn: d.date !== '' && dates.has(d.date),
//       }));

//       // Group days into weeks (7 days per week)
//       const weeksData: WeekRow[] = [];
//       for (let i = 0; i < daysWithCheckIns.length; i += 7) {
//         weeksData.push(daysWithCheckIns.slice(i, i + 7));
//       }

//       setWeeks(weeksData);
//     };

//     useEffect(() => {
//       loadCalendar();
//     }, [userId]);

//     useImperativeHandle(ref, () => ({
//       refresh: loadCalendar,
//     }));

//     const monthNames = [
//       'Janeiro',
//       'Fevereiro',
//       'Março',
//       'Abril',
//       'Maio',
//       'Junho',
//       'Julho',
//       'Agosto',
//       'Setembro',
//       'Outubro',
//       'Novembro',
//       'Dezembro',
//     ];
//     const currentMonth = monthNames[new Date().getMonth()];
//     const dayHeaders = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

//     return (
//       <View>
//         <Text style={typography.caption}>{currentMonth}</Text>
//         <View style={styles.calendarContainer}>
//           {/* Day headers */}
//           <View style={styles.weekRow}>
//             {dayHeaders.map((header, index) => (
//               <View key={index} style={styles.dayHeader}>
//                 <Text style={styles.dayHeaderLabel}>{header}</Text>
//               </View>
//             ))}
//           </View>

//           {/* Weeks */}
//           {weeks.map((week, weekIndex) => (
//             <View key={weekIndex} style={styles.weekRow}>
//               {week.map((day, dayIndex) => (
//                 <View key={`${weekIndex}-${dayIndex}`} style={styles.dayCell}>
//                   {!day.isEmpty && (
//                     <View style={[styles.day, day.hasCheckIn && styles.dayActive]}>
//                       <Text style={styles.dayLabel}>{day.label}</Text>
//                     </View>
//                   )}
//                 </View>
//               ))}
//             </View>
//           ))}
//         </View>
//       </View>
//     );
//   },
// );

// CalendarFrequency.displayName = 'CalendarFrequency';
