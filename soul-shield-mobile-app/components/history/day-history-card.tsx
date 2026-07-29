import { StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { StatusBadge } from '@/components/task/status-badge';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayDate } from '@/lib/date';

interface DayHistoryCardProps {
  date: string;
  tasks: Task[];
}

export function DayHistoryCard({ date, tasks }: DayHistoryCardProps) {
  const cardColor = useThemeColor({}, 'card');
  const mutedColor = useThemeColor({}, 'muted');
  const tintColor = useThemeColor({}, 'tint');
  const categoryFallback = useThemeColor({}, 'categoryFallback');

  return (
    <View style={[styles.card, { backgroundColor: cardColor }]}>
      <ThemedText type="defaultSemiBold">{formatDisplayDate(date)}</ThemedText>
      <View style={styles.list}>
        {tasks.map((task) => (
          <View key={task.task_id} style={styles.row}>
            <View
              style={[
                styles.dot,
                { backgroundColor: task.category_color ?? categoryFallback },
              ]}
            />
            <ThemedText style={styles.title} numberOfLines={1}>
              {task.title}
            </ThemedText>
            {task.is_global ? <IconSymbol name="shield.fill" size={14} color={tintColor} /> : null}
            <StatusBadge
              label={task.status === 'completed' ? 'Completed' : task.status === 'missed' ? 'Missed' : 'Pending'}
              tone={task.status === 'completed' ? 'success' : task.status === 'missed' ? 'danger' : 'neutral'}
            />
          </View>
        ))}
        {tasks.length === 0 ? (
          <ThemedText style={{ color: mutedColor }}>No tasks scheduled.</ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderCurve: 'continuous', padding: 16, gap: 12 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { flex: 1, fontSize: 14 },
});
