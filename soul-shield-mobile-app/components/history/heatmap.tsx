import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { monthShortLabel, weekdayIndex } from '@/lib/date';

export interface HeatmapDay {
  date: string;
  completed: number;
  total: number;
}

interface HeatmapProps {
  days: HeatmapDay[];
}

const SQUARE_SIZE = 12;
const SQUARE_GAP = 3;
const ROW_HEIGHT = SQUARE_SIZE + SQUARE_GAP;
const COLUMN_WIDTH = SQUARE_SIZE + SQUARE_GAP;
const MONTH_ROW_HEIGHT = 16;
// Rows shown for weekday labels (0=Sun ... 6=Sat) — matches GitHub's Mon/Wed/Fri convention.
const LABELED_ROWS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

type Cell = HeatmapDay | null;

function levelFor(day: HeatmapDay): 0 | 1 | 2 | 3 | 4 {
  if (day.total === 0) return 0;
  const ratio = day.completed / day.total;
  if (ratio === 0) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 1) return 3;
  return 4;
}

export function Heatmap({ days }: HeatmapProps) {
  const track = useThemeColor({}, 'border');
  const success = useThemeColor({}, 'success');
  const muted = useThemeColor({}, 'muted');

  const levelColors = [track, `${success}33`, `${success}66`, `${success}A6`, success];

  const weeks = useMemo(() => {
    if (days.length === 0) return [] as Cell[][];
    const leadingEmpty = weekdayIndex(days[0].date);
    const totalCells = leadingEmpty + days.length;
    const weekCount = Math.ceil(totalCells / 7);
    const grid: Cell[][] = Array.from({ length: weekCount }, () => Array(7).fill(null));

    days.forEach((day, index) => {
      const cellIndex = index + leadingEmpty;
      const week = Math.floor(cellIndex / 7);
      const row = cellIndex % 7;
      grid[week][row] = day;
    });

    return grid;
  }, [days]);

  const monthLabels = useMemo(() => {
    let lastMonth = '';
    return weeks.map((week) => {
      const firstDay = week.find((cell): cell is HeatmapDay => cell !== null);
      if (!firstDay) return '';
      const month = monthShortLabel(firstDay.date);
      if (month === lastMonth) return '';
      lastMonth = month;
      return month;
    });
  }, [weeks]);

  if (days.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.weekdayColumn}>
          <View style={{ height: MONTH_ROW_HEIGHT }} />
          {Array.from({ length: 7 }, (_, row) => (
            <View key={row} style={{ height: ROW_HEIGHT, justifyContent: 'center' }}>
              <Text style={[styles.weekdayLabel, { color: muted }]}>{LABELED_ROWS[row] ?? ''}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.monthRow}>
              {monthLabels.map((label, index) => (
                <Text
                  key={index}
                  style={[styles.monthLabel, { color: muted, width: COLUMN_WIDTH }]}
                  numberOfLines={1}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.weeksRow}>
              {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.weekColumn}>
                  {week.map((cell, rowIndex) => (
                    <View
                      key={rowIndex}
                      style={[
                        styles.square,
                        { backgroundColor: cell ? levelColors[levelFor(cell)] : 'transparent' },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.legendRow}>
        <Text style={[styles.legendLabel, { color: muted }]}>Less</Text>
        {levelColors.map((color, index) => (
          <View key={index} style={[styles.square, { backgroundColor: color }]} />
        ))}
        <Text style={[styles.legendLabel, { color: muted }]}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  container: { flexDirection: 'row', gap: 6 },
  weekdayColumn: { width: 28 },
  weekdayLabel: { fontSize: 10 },
  monthRow: { flexDirection: 'row', height: MONTH_ROW_HEIGHT },
  monthLabel: { fontSize: 10 },
  weeksRow: { flexDirection: 'row', gap: SQUARE_GAP },
  weekColumn: { gap: SQUARE_GAP },
  square: { width: SQUARE_SIZE, height: SQUARE_SIZE, borderRadius: 3, borderCurve: 'continuous' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  legendLabel: { fontSize: 11, marginHorizontal: 2 },
});
