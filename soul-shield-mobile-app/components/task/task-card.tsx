import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { CounterTaskControls } from '@/components/task/counter-task-controls';
import { RewardBanner } from '@/components/task/reward-banner';
import { StatusBadge } from '@/components/task/status-badge';
import { SubTaskList } from '@/components/task/sub-task-list';
import { TaskDetailsInline } from '@/components/task/task-details-inline';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { isToday } from '@/lib/date';

interface TaskCardProps {
  task: Task;
  date: string;
  /** Whether the current user is an admin — fixed/global tasks can only be
   * edited/deleted by admins, personal tasks always by their owner. */
  isAdmin: boolean;
  /** Shows an explicit category chip even for tasks with no category, so a
   * task keeps its original-category context when displayed somewhere that
   * groups by status rather than category (the Completed Tasks section). */
  showCategoryBadge?: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Fired once, right when a counter task's increment pushes it to
   * 'completed' and the server returns reward_text. Normal-task completion
   * fires its own reward straight from the mutation call site (see
   * app/(tabs)/index.tsx) — completing a task moves its card from an active
   * section into the separate "Completed Tasks" section, which unmounts and
   * remounts TaskCard in a new subtree, so any modal state owned here would
   * be wiped before the reward text ever arrived. Ownership lives one level
   * up (the screen) instead, where it survives that remount. */
  onRewardEarned?: (text: string) => void;
}

export function TaskCard({
  task,
  date,
  isAdmin,
  showCategoryBadge,
  onToggleComplete,
  onEdit,
  onDelete,
  onRewardEarned,
}: TaskCardProps) {
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');
  const completedTint = useThemeColor({}, 'completedTint');
  const missedTint = useThemeColor({}, 'missedTint');
  const partiallyCompletedTint = useThemeColor({}, 'partiallyCompletedTint');
  const categoryFallback = useThemeColor({}, 'categoryFallback');

  const isMissed = task.status === 'missed';
  const isCompleted = task.status === 'completed';
  const isPartiallyCompleted = task.status === 'partially_completed';
  const isCounter = task.task_type === 'counter';
  const hasSubTasks = Boolean(task.sub_tasks?.length);
  const accentColor = task.category_color ?? categoryFallback;
  const canManage = task.is_global ? isAdmin : true;
  // Only today's tasks can actually be completed — browsing a past/future day
  // via the date nav header is view-only, otherwise you could tick off a
  // future day's task before it's even "happened" or backfill history at will.
  const isReadOnly = !isToday(date);
  const controlsDisabled = isMissed || isReadOnly;
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const backgroundColor = isCompleted
    ? completedTint
    : isPartiallyCompleted
      ? partiallyCompletedTint
      : isMissed
        ? missedTint
        : cardColor;

  return (
    <View style={[styles.card, { backgroundColor, borderLeftColor: accentColor }]}>
      <View style={styles.headerRow}>
        {!isCounter && !hasSubTasks ? (
          // TODO this button is for toggling completion of a normal type task
          <Pressable
            disabled={controlsDisabled}
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
        {/* Only the title/description expand the inline details section —
            checkbox above and counter/sub-task controls below are separate
            Pressables, so tapping them never triggers it. */}
        {/* TODO this button is for expanding/collapsing the task's inline details */}
        <Pressable
          onPress={() => setDetailsExpanded((v) => !v)}
          style={styles.titleTouchable}
          hitSlop={4}>
          <ThemedText
            type="defaultSemiBold"
            style={[styles.title, isMissed && styles.strikethrough]}
            numberOfLines={2}>
            {task.title}
          </ThemedText>
        </Pressable>
        <IconSymbol
          name="chevron.right"
          size={16}
          color={mutedColor}
          style={{ transform: [{ rotate: detailsExpanded ? '90deg' : '0deg' }] }}
        />
        {task.is_global ? <IconSymbol name="shield.fill" size={18} color={tintColor} /> : null}
      </View>

      {task.description ? (
        <Pressable onPress={() => setDetailsExpanded((v) => !v)}>
          <ThemedText
            style={[styles.description, { color: mutedColor }]}
            numberOfLines={detailsExpanded ? undefined : 3}>
            {task.description}
          </ThemedText>
        </Pressable>
      ) : null}

      {detailsExpanded ? <TaskDetailsInline task={task} /> : null}

      {task.category_name ? (
        <View style={[styles.categoryChip, { borderColor: accentColor }]}>
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
          <ThemedText style={styles.categoryLabel}>{task.category_name}</ThemedText>
        </View>
      ) : showCategoryBadge && !task.is_global ? (
        <View style={[styles.categoryChip, { borderColor: categoryFallback }]}>
          <View style={[styles.dot, { backgroundColor: categoryFallback }]} />
          <ThemedText style={styles.categoryLabel}>Uncategorized</ThemedText>
        </View>
      ) : null}

      {isCounter && !hasSubTasks ? (
        <CounterTaskControls
          task={task}
          date={date}
          disabled={controlsDisabled}
          accentColor={accentColor}
          onRewardEarned={onRewardEarned}
        />
      ) : null}

      {hasSubTasks ? (
        <SubTaskList
          taskId={task.task_id}
          subTasks={task.sub_tasks!}
          date={date}
          disabled={controlsDisabled}
          onRewardEarned={onRewardEarned}
        />
      ) : null}

      {isCompleted && task.reward_text ? <RewardBanner text={task.reward_text} /> : null}
      {isPartiallyCompleted ? <StatusBadge label="Partially Completed" tone="warning" /> : null}
      {isMissed ? <StatusBadge label="Missed" tone="danger" /> : null}

      {canManage ? (
        <View style={styles.actions}>
          {/* TODO this button is for navigating to the edit task screen */}
          <Pressable onPress={onEdit} hitSlop={8} style={styles.actionButton}>
            <IconSymbol name="pencil" size={18} color={mutedColor} />
          </Pressable>
          {/* TODO this button is for deleting this task */}
          <Pressable onPress={onDelete} hitSlop={8} style={styles.actionButton}>
            <IconSymbol name="trash" size={18} color={dangerColor} />
          </Pressable>
        </View>
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
  titleTouchable: { flex: 1 },
  title: {},
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
