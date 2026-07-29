import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { CounterTaskControls } from '@/components/task/counter-task-controls';
import { RewardBanner } from '@/components/task/reward-banner';
import { RewardModal } from '@/components/task/reward-modal';
import { StatusBadge } from '@/components/task/status-badge';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface TaskCardProps {
  task: Task;
  date: string;
  canManage: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskCard({ task, date, canManage, onToggleComplete, onEdit, onDelete }: TaskCardProps) {
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');
  const completedTint = useThemeColor({}, 'completedTint');
  const missedTint = useThemeColor({}, 'missedTint');
  const categoryFallback = useThemeColor({}, 'categoryFallback');

  const isMissed = task.status === 'missed';
  const isCompleted = task.status === 'completed';
  const isCounter = task.task_type === 'counter';
  const accentColor = task.category_color ?? categoryFallback;

  const backgroundColor = isCompleted ? completedTint : isMissed ? missedTint : cardColor;

  const [showRewardModal, setShowRewardModal] = useState(false);
  const prevStatusRef = useRef(task.status);

  useEffect(() => {
    if (prevStatusRef.current !== 'completed' && task.status === 'completed' && task.reward_text) {
      setShowRewardModal(true);
    }
    prevStatusRef.current = task.status;
  }, [task.status, task.reward_text]);

  return (
    <View style={[styles.card, { backgroundColor, borderLeftColor: accentColor }]}>
      <View style={styles.headerRow}>
        {!isCounter ? (
          <Pressable
            disabled={isMissed}
            onPress={onToggleComplete}
            hitSlop={8}
            style={styles.checkbox}>
            <IconSymbol
              name={isCompleted ? 'checkmark.circle.fill' : 'circle'}
              size={24}
              color={isCompleted ? successColor : mutedColor}
            />
          </Pressable>
        ) : null}
        <ThemedText
          type="defaultSemiBold"
          style={[styles.title, isMissed && styles.strikethrough]}
          numberOfLines={2}>
          {task.title}
        </ThemedText>
        {task.is_global ? <IconSymbol name="shield.fill" size={18} color={tintColor} /> : null}
      </View>

      {task.description ? (
        <ThemedText style={[styles.description, { color: mutedColor }]} numberOfLines={3}>
          {task.description}
        </ThemedText>
      ) : null}

      {task.category_name ? (
        <View style={[styles.categoryChip, { borderColor: accentColor }]}>
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
          <ThemedText style={styles.categoryLabel}>{task.category_name}</ThemedText>
        </View>
      ) : null}

      {isCounter ? (
        <CounterTaskControls task={task} date={date} disabled={isMissed} accentColor={accentColor} />
      ) : null}

      {isCompleted && task.reward_text ? <RewardBanner text={task.reward_text} /> : null}
      {isMissed ? <StatusBadge label="Missed" tone="danger" /> : null}

      {canManage ? (
        <View style={styles.actions}>
          <Pressable onPress={onEdit} hitSlop={8} style={styles.actionButton}>
            <IconSymbol name="pencil" size={18} color={mutedColor} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} style={styles.actionButton}>
            <IconSymbol name="trash" size={18} color={dangerColor} />
          </Pressable>
        </View>
      ) : null}

      {task.reward_text ? (
        <RewardModal
          visible={showRewardModal}
          text={task.reward_text}
          onClose={() => setShowRewardModal(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderCurve: 'continuous',
    borderLeftWidth: 4,
    padding: 16,
    gap: 10,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { padding: 2 },
  title: { flex: 1 },
  strikethrough: { textDecorationLine: 'line-through' },
  description: { fontSize: 14 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  categoryLabel: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  actionButton: { padding: 4 },
});
