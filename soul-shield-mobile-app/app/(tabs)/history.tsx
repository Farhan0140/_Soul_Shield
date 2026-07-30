import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { DayHistoryCard } from '@/components/history/day-history-card';
import { Heatmap, type HeatmapDay } from '@/components/history/heatmap';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useTaskHistoryQuery } from '@/hooks/queries/use-tasks';
import { useThemeColor } from '@/hooks/use-theme-color';
import { addDays, dateRange, formatDisplayDate, fromISODate, toISODate, todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';

type ActiveField = 'from' | 'to' | null;

export default function HistoryScreen() {
  const [from, setFrom] = useState(addDays(todayISODate(), -6));
  const [to, setTo] = useState(todayISODate());
  const [activeField, setActiveField] = useState<ActiveField>(null);

  const historyQuery = useTaskHistoryQuery(from, to);
  const cardColor = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of historyQuery.data ?? []) {
      const list = map.get(task.date) ?? [];
      list.push(task);
      map.set(task.date, list);
    }
    return map;
  }, [historyQuery.data]);

  const days = useMemo(() => dateRange(from, to), [from, to]);

  const heatmapDays: HeatmapDay[] = useMemo(
    () =>
      days.map((date) => {
        const dayTasks = tasksByDate.get(date) ?? [];
        return {
          date,
          completed: dayTasks.filter((t) => t.status === 'completed').length,
          total: dayTasks.length,
        };
      }),
    [days, tasksByDate]
  );

  const handleChangeDate = (field: 'from' | 'to') => (_event: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setActiveField(null);
    if (!selected) return;
    const iso = toISODate(selected);
    if (field === 'from') setFrom(iso);
    else setTo(iso);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <ThemedText type="title">History</ThemedText>

      <View style={styles.rangeRow}>
        <Pressable
          onPress={() => setActiveField(activeField === 'from' ? null : 'from')}
          style={[styles.rangeButton, { backgroundColor: cardColor, borderColor: border }]}>
          <ThemedText style={styles.rangeLabel}>From</ThemedText>
          <ThemedText type="defaultSemiBold">{formatDisplayDate(from)}</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveField(activeField === 'to' ? null : 'to')}
          style={[styles.rangeButton, { backgroundColor: cardColor, borderColor: border }]}>
          <ThemedText style={styles.rangeLabel}>To</ThemedText>
          <ThemedText type="defaultSemiBold">{formatDisplayDate(to)}</ThemedText>
        </Pressable>
      </View>

      {activeField === 'from' ? (
        <DateTimePicker
          value={fromISODate(from)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={fromISODate(to)}
          onChange={handleChangeDate('from')}
        />
      ) : null}
      {activeField === 'to' ? (
        <DateTimePicker
          value={fromISODate(to)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={fromISODate(from)}
          maximumDate={fromISODate(todayISODate())}
          onChange={handleChangeDate('to')}
        />
      ) : null}

      <View style={styles.section}>
        <ThemedText type="defaultSemiBold">Completion Heatmap</ThemedText>
        <Heatmap days={heatmapDays} />
      </View>

      {historyQuery.isLoading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : historyQuery.isError ? (
        <ErrorState message={getErrorMessage(historyQuery.error)} onRetry={() => historyQuery.refetch()} />
      ) : (
        <View style={styles.list}>
          {[...days].reverse().map((date) => (
            <DayHistoryCard key={date} date={date} tasks={tasksByDate.get(date) ?? []} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 20 },
  rangeRow: { flexDirection: 'row', gap: 12 },
  rangeButton: { flex: 1, borderWidth: 1, borderRadius: 14, borderCurve: 'continuous', padding: 12, gap: 2 },
  rangeLabel: { fontSize: 12, opacity: 0.7 },
  section: { gap: 10 },
  list: { gap: 12 },
});
