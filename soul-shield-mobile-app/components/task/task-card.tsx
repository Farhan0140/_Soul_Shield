import { router } from 'expo-router';
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
  /** 'template' renders a fixed task as a read-only template card — no
   * completion controls or personal progress, just an add-to-my-tasks
   * action (see app/category/[id].tsx's 'fixed' pseudo-category). */
  variant?: 'template';
  /** Only used when variant='template'. */
  alreadyAdded?: boolean;
  isAdding?: boolean;
  onAddToMyTasks?: () => void;
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
  variant,
  alreadyAdded,
  isAdding,
  onAddToMyTasks,
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

  const isTemplate = variant === 'template';
  const isMissed = task.status === 'missed';
  const isCompleted = task.status === 'completed';
  const isPartiallyCompleted = task.status === 'partially_completed';
  const isCounter = task.task_type === 'counter';
  const isTimer = task.task_type === 'timer';
  const hasSubTasks = Boolean(task.sub_tasks?.length);
  const accentColor = task.category_color ?? categoryFallback;
  const canManage = !isTemplate && (task.is_global ? isAdmin : true);
  // Template cards (the "Fixed Tasks" pseudo-category) are otherwise
  // read-only — but an admin still needs a way to delete the fixed task
  // itself from here, not just from the dedicated Admin Panel.
  const canDeleteTemplate = isTemplate && task.is_global && isAdmin;
  // Only today's tasks can actually be completed — browsing a past/future day
  // via the date nav header is view-only, otherwise you could tick off a
  // future day's task before it's even "happened" or backfill history at will.
  const isReadOnly = !isToday(date);
  const controlsDisabled = isMissed || isReadOnly;
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const handleOpenCounter = () =>
    router.push({ pathname: '/counter/[taskId]', params: { taskId: String(task.task_id), date } });

  const handleOpenTimer = () =>
    router.push({ pathname: '/timer-task/[taskId]', params: { taskId: String(task.task_id), date } });

  // Counter and timer tasks each have their own dedicated page — tapping
  // anywhere on the card (not just the small link at the bottom) should jump
  // straight there instead of expanding the inline details other task types use.
  const openPageHandler =
    !isTemplate && !hasSubTasks ? (isCounter ? handleOpenCounter : isTimer ? handleOpenTimer : null) : null;

  const backgroundColor = isCompleted
    ? completedTint
    : isPartiallyCompleted
      ? partiallyCompletedTint
      : isMissed
        ? missedTint
        : cardColor;

  return (
    <Pressable
      disabled={!openPageHandler}
      onPress={openPageHandler ?? undefined}
      style={[styles.card, { backgroundColor, borderLeftColor: accentColor }]}>
      <View style={styles.headerRow}>
        {!isTemplate && !isCounter && !isTimer && !hasSubTasks ? (
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
            Pressables, so tapping them never triggers it. Counter/timer
            tasks skip this: the whole card is already one Pressable routing
            to their dedicated page (see openPageHandler above), so the title
            here is plain (non-Pressable) text and lets that tap through. */}
        {openPageHandler ? (
          <View style={styles.titleTouchable}>
            <ThemedText
              type="defaultSemiBold"
              style={[styles.title, isMissed && styles.strikethrough]}
              numberOfLines={2}>
              {task.title}
            </ThemedText>
          </View>
        ) : (
          // TODO this button is for expanding/collapsing the task's inline details
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
        )}
        {!openPageHandler ? (
          <IconSymbol
            name="chevron.right"
            size={16}
            color={mutedColor}
            style={{ transform: [{ rotate: detailsExpanded ? '90deg' : '0deg' }] }}
          />
        ) : null}
        {task.is_global ? <IconSymbol name="shield.fill" size={18} color={tintColor} /> : null}
      </View>

      {task.description ? (
        openPageHandler ? (
          <ThemedText style={[styles.description, { color: mutedColor }]} numberOfLines={3}>
            {task.description}
          </ThemedText>
        ) : (
          <Pressable onPress={() => setDetailsExpanded((v) => !v)}>
            <ThemedText
              style={[styles.description, { color: mutedColor }]}
              numberOfLines={detailsExpanded ? undefined : 3}>
              {task.description}
            </ThemedText>
          </Pressable>
        )
      ) : null}

      {!openPageHandler && detailsExpanded ? <TaskDetailsInline task={task} /> : null}

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

      {!isTemplate && isCounter && !hasSubTasks ? (
        <View style={styles.counterSection}>
          <Pressable onPress={handleOpenCounter} hitSlop={8} style={styles.openCounterLink}>
            <IconSymbol name="arrow.up.right.square" size={14} color={mutedColor} />
          </Pressable>

          <CounterTaskControls
            task={task}
            date={date}
            disabled={controlsDisabled}
            accentColor={accentColor}
            onRewardEarned={onRewardEarned}
          />
        </View>
      ) : null}

      {!isTemplate && isTimer && !hasSubTasks ? (
        <View style={styles.counterSection}>
          {/* TODO this button is for opening the dedicated timer page for this task */}
          <Pressable onPress={handleOpenTimer} hitSlop={8} style={styles.openCounterLink}>
            <IconSymbol name="timer" size={14} color={mutedColor} />
            <ThemedText style={[styles.openCounterLabel, { color: mutedColor }]}>Start timer</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {!isTemplate && hasSubTasks ? (
        <SubTaskList
          taskId={task.task_id}
          subTasks={task.sub_tasks!}
          date={date}
          disabled={controlsDisabled}
          onRewardEarned={onRewardEarned}
        />
      ) : null}

      {!isTemplate && isCompleted && task.reward_text ? <RewardBanner text={task.reward_text} /> : null}
      {!isTemplate && isPartiallyCompleted ? <StatusBadge label="Partially Completed" tone="warning" /> : null}
      {!isTemplate && isMissed ? <StatusBadge label="Missed" tone="danger" /> : null}

      {isTemplate ? (
        <View style={styles.templateActions}>
          <Pressable
            disabled={alreadyAdded || isAdding}
            onPress={onAddToMyTasks}
            style={[
              styles.addButton,
              { backgroundColor: alreadyAdded ? `${successColor}1A` : tintColor },
            ]}>
            <IconSymbol
              name={alreadyAdded ? 'checkmark.circle.fill' : 'plus.circle.fill'}
              size={18}
              color={alreadyAdded ? successColor : '#fff'}
            />
            <ThemedText
              style={[styles.addButtonLabel, { color: alreadyAdded ? successColor : '#fff' }]}>
              {alreadyAdded ? 'Already Added' : isAdding ? 'Adding…' : 'Add to Your Own Tasks'}
            </ThemedText>
          </Pressable>

          {canDeleteTemplate ? (
            // TODO this button is for deleting this fixed task (admin only)
            <Pressable
              onPress={onDelete}
              hitSlop={8}
              style={[styles.templateDeleteButton, { borderColor: `${dangerColor}4D` }]}>
              <IconSymbol name="trash" size={18} color={dangerColor} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

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
    </Pressable>
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
  counterSection: { gap: 8 },
  openCounterLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
  openCounterLabel: { fontSize: 12, fontWeight: '600' },
  templateActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  addButtonLabel: { fontSize: 14, fontWeight: '700' },
  templateDeleteButton: {
    padding: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
});
