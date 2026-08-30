import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Task, TaskStatus } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { StatusBadge } from '@/components/task/status-badge';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayDate } from '@/lib/date';

interface DayHistoryCardProps {
  date: string;
  tasks: Task[];
}

const STATUS_META: Record<TaskStatus, { label: string; tone: 'success' | 'danger' | 'neutral' | 'warning' }> = {
  completed: { label: 'Completed', tone: 'success' },
  missed: { label: 'Missed', tone: 'danger' },
  partially_completed: { label: 'Partially Completed', tone: 'warning' },
  pending: { label: 'Pending', tone: 'neutral' },
};

function countByStatus(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { completed: 0, missed: 0, partially_completed: 0, pending: 0 };
  for (const task of tasks) counts[task.status] += 1;
  return counts;
}

/** A day's row in the History list. Shows only the day's status counts — not
 * every task, per feedback that scanning full task titles for every day in
 * the range was too much to read at a glance. Tapping opens a sheet with the
 * same per-task title + status rows this card used to show inline. */
export function DayHistoryCard({ date, tasks }: DayHistoryCardProps) {
  const [detailsVisible, setDetailsVisible] = useState(false);

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');
  const warningColor = useThemeColor({}, 'warning');
  const categoryFallback = useThemeColor({}, 'categoryFallback');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const counts = countByStatus(tasks);
  const hasTasks = tasks.length > 0;

  return (
    <>
      <Pressable
        onPress={() => setDetailsVisible(true)}
        disabled={!hasTasks}
        style={({ pressed }) => [styles.card, { backgroundColor: cardColor, opacity: pressed ? 0.85 : 1 }]}>
        <View style={styles.header}>
          <ThemedText type="defaultSemiBold">{formatDisplayDate(date)}</ThemedText>
          {hasTasks ? <IconSymbol name="chevron.right" size={16} color={mutedColor} /> : null}
        </View>
        {hasTasks ? (
          <View style={styles.statsRow}>
            <StatTile label="Completed" count={counts.completed} color={successColor} />
            <StatTile label="Partial" count={counts.partially_completed} color={warningColor} />
            <StatTile label="Pending" count={counts.pending} color={mutedColor} />
            <StatTile label="Missed" count={counts.missed} color={dangerColor} />
          </View>
        ) : (
          <ThemedText style={{ color: mutedColor }}>No tasks scheduled.</ThemedText>
        )}
      </Pressable>

      <Modal
        visible={detailsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsVisible(false)}>
        <View style={styles.backdrop}>
          {/* Absolutely-filled tap-to-close layer behind the sheet, rather
              than a Pressable wrapping the sheet itself — a Pressable there
              would compete with the ScrollView below for the scroll gesture
              and could swallow it, leaving the list stuck. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDetailsVisible(false)}
            accessibilityLabel="Close"
          />
          <View
            pointerEvents="box-none"
            style={[styles.sheet, { backgroundColor: cardColor, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.handle, { backgroundColor: borderColor }]} />
            <ThemedText type="subtitle" style={styles.sheetTitle}>
              {formatDisplayDate(date)}
            </ThemedText>
            <ScrollView style={{ maxHeight: windowHeight * 0.6 }} showsVerticalScrollIndicator={false}>
              {tasks.map((task) => (
                <View key={task.task_id} style={styles.row}>
                  <View
                    style={[styles.dot, { backgroundColor: task.category_color ?? categoryFallback }]}
                  />
                  <ThemedText style={styles.title} numberOfLines={2}>
                    {task.title}
                  </ThemedText>
                  <StatusBadge label={STATUS_META[task.status].label} tone={STATUS_META[task.status].tone} />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function StatTile({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.tile}>
      <ThemedText type="defaultSemiBold" style={[styles.tileCount, { color }]}>
        {count}
      </ThemedText>
      <ThemedText style={styles.tileLabel}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderCurve: 'continuous', padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsRow: { flexDirection: 'row' },
  tile: { flex: 1, alignItems: 'center', gap: 2 },
  tileCount: { fontSize: 18, fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 11, opacity: 0.7 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    padding: 20,
    gap: 6,
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: { marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { flex: 1, fontSize: 14 },
});
