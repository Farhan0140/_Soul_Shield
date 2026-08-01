import { Pressable, StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface GlobalTaskRowProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
}

const RECURRENCE_LABEL: Record<Task['recurrence_type'], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  custom: 'Custom',
};

export function GlobalTaskRow({ task, onEdit, onDelete }: GlobalTaskRowProps) {
  const cardColor = useThemeColor({}, 'card');
  const mutedColor = useThemeColor({}, 'muted');
  const dangerColor = useThemeColor({}, 'danger');
  const categoryFallback = useThemeColor({}, 'categoryFallback');

  return (
    <View style={[styles.row, { backgroundColor: cardColor }]}>
      <View style={[styles.dot, { backgroundColor: task.category_color ?? categoryFallback }]} />
      <View style={styles.info}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {task.title}
        </ThemedText>
        <ThemedText style={{ color: mutedColor, fontSize: 12 }}>
          {RECURRENCE_LABEL[task.recurrence_type]} · {task.task_type === 'counter' ? 'Counter' : 'Normal'}
        </ThemedText>
      </View>
      {/* TODO this button is for navigating to the edit screen for this global/fixed task */}
      <Pressable onPress={onEdit} hitSlop={8} style={styles.actionButton}>
        <IconSymbol name="pencil" size={18} color={mutedColor} />
      </Pressable>
      {/* TODO this button is for deleting this global/fixed task */}
      <Pressable onPress={onDelete} hitSlop={8} style={styles.actionButton}>
        <IconSymbol name="trash" size={18} color={dangerColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  info: { flex: 1, gap: 2 },
  actionButton: { padding: 4 },
});
