import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { SubTask } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { CounterProgressBar } from '@/components/task/counter-progress-bar';
import { QuickAddButtons } from '@/components/task/quick-add-buttons';
import { ExpandableText } from '@/components/ui/expandable-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useLocale } from '@/context/locale-context';
import { useCompleteSubTask, useIncrementSubTask } from '@/hooks/queries/use-task-mutations';
import { useThemeColor } from '@/hooks/use-theme-color';
import { hapticLight } from '@/lib/feedback';

/** How many incomplete sub-tasks one page shows — a sub-tasked Main Task's
 * section stays a short, scannable list no matter how many sub-tasks it has
 * (completed ones move to the collapsible section below, see SubTaskList). */
const SUB_TASKS_PER_PAGE = 2;

interface SubTaskRowProps {
  subTask: SubTask;
  disabled?: boolean;
  onComplete: (subTask: SubTask) => void;
  onIncrement: (subTask: SubTask, amount: number) => void;
  onOpenCounter: (subTask: SubTask) => void;
  onOpenTimer: (subTask: SubTask) => void;
}

/** One interactive sub-task row — extracted from the original inline map body
 * so the active (paginated) list and the expanded "Completed Sub-Tasks"
 * section render the exact same row: same checkbox toggle (tapping a
 * completed row un-completes it, via the real toggle in
 * useCompleteSubTask/toggleSubTaskCompletionLocal), same counter/timer page
 * routing, same counter progress + quick-add controls. Defined at module
 * scope (not inside SubTaskList) so React keeps row state between renders. */
function SubTaskRow({ subTask, disabled, onComplete, onIncrement, onOpenCounter, onOpenTimer }: SubTaskRowProps) {
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success');
  const borderColor = useThemeColor({}, 'border');
  const rowBackground = useThemeColor({}, 'background');

  const isCompleted = subTask.status === 'completed';
  const isCounter = subTask.task_type === 'counter';
  const isTimer = subTask.task_type === 'timer';

  // Counter/timer sub-tasks have their own dedicated page — tapping
  // anywhere on the row (not just the small arrow icon) opens it.
  const openPageHandler = isCounter
    ? () => onOpenCounter(subTask)
    : isTimer
      ? () => onOpenTimer(subTask)
      : null;

  return (
    <Pressable
      disabled={!openPageHandler}
      onPress={openPageHandler ?? undefined}
      style={[styles.row, { backgroundColor: rowBackground, borderColor }]}>
      <View style={styles.rowHeader}>
        {!isCounter && !isTimer ? (
          // TODO this button is for toggling completion of a normal type sub-task
          <Pressable
            disabled={disabled}
            onPress={() => {
              hapticLight();
              onComplete(subTask);
            }}
            hitSlop={8}
            style={styles.checkbox}>
            <IconSymbol
              name={isCompleted ? 'checkmark.circle.fill' : 'circle'}
              size={20}
              color={isCompleted ? successColor : mutedColor}
            />
          </Pressable>
        ) : null}
        <ExpandableText
          text={subTask.title}
          maxLines={2}
          containerStyle={{ flex: 1 }}
          style={[styles.title, isCompleted && styles.strikethrough]}
        />
        {isCounter ? (
          // TODO this button is for opening the dedicated counter page for this sub-task
          <Pressable onPress={() => onOpenCounter(subTask)} hitSlop={8}>
            <IconSymbol name="arrow.up.right.square" size={16} color={mutedColor} />
          </Pressable>
        ) : null}
        {isTimer ? (
          // TODO this button is for opening the dedicated timer page for this sub-task
          <Pressable onPress={() => onOpenTimer(subTask)} hitSlop={8}>
            <IconSymbol name="arrow.up.right.square" size={16} color={mutedColor} />
          </Pressable>
        ) : null}
      </View>

      {subTask.description ? (
        // Optional details directly below the title — collapsed to two lines
        // when long, tap to expand/collapse (see ExpandableText).
        <ExpandableText
          text={subTask.description}
          maxLines={2}
          style={[styles.subDescription, isCompleted && styles.strikethrough, { color: mutedColor }]}
        />
      ) : null}

      {isCounter ? (
        <View style={styles.counterControls}>
          <CounterProgressBar progress={subTask.progress_count ?? 0} target={subTask.target_count ?? 0} />
          <QuickAddButtons disabled={disabled || isCompleted} onAdd={(amount) => onIncrement(subTask, amount)} />
        </View>
      ) : null}
    </Pressable>
  );
}

interface SubTaskListProps {
  taskId: string;
  subTasks: SubTask[];
  date: string;
  disabled?: boolean;
  /** Fired once, only when this action pushes every sibling sub-task to
   * 'completed' too (parent_status flips to 'completed') and the parent has
   * reward text — mirrors CounterTaskControls' onRewardEarned so the same
   * screen-owned reward modal (see app/(tabs)/index.tsx) fires for sub-tasked
   * parents exactly once, not per individual sub-task. */
  onRewardEarned?: (text: string) => void;
}

export function SubTaskList({ taskId, subTasks, date, disabled, onRewardEarned }: SubTaskListProps) {
  const { t } = useLocale();
  const borderColor = useThemeColor({}, 'border');
  const successColor = useThemeColor({}, 'success');
  const completeSubTask = useCompleteSubTask();
  const incrementSubTask = useIncrementSubTask();

  const [page, setPage] = useState(1);
  // Collapsed by default — the requirement spec for the Completed section.
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Presentation-only split: the parent's derived status (pending →
  // partially_completed → completed, incl. its reward) is still computed from
  // ALL sub-tasks by lib/db/tasks-repo.ts's computeParentStatus — nothing
  // about completion or aggregation logic changes here. Order within each
  // list is the sub-tasks' own position order, as sent.
  const activeSubTasks = subTasks.filter((s) => s.status !== 'completed');
  const completedSubTasks = subTasks.filter((s) => s.status === 'completed');

  const totalPages = Math.max(1, Math.ceil(activeSubTasks.length / SUB_TASKS_PER_PAGE));
  // Clamp instead of reading an empty page when the active list shrinks under
  // the current page (a sub-task got completed, or a refresh) — the bar
  // recalculates automatically and the reader lands on the new last page.
  // `page` state itself is left alone: every control below works off the
  // clamped value, and it converges again as the list grows back.
  const currentPage = Math.min(page, totalPages);
  const pageRows = activeSubTasks.slice(
    (currentPage - 1) * SUB_TASKS_PER_PAGE,
    currentPage * SUB_TASKS_PER_PAGE
  );

  const handleComplete = (subTask: SubTask) => {
    completeSubTask.mutate(
      { taskId, subTaskId: subTask.sub_task_id, date },
      {
        onSuccess: (data) => {
          if (data.parent_status === 'completed' && data.parent_reward_text) {
            onRewardEarned?.(data.parent_reward_text);
          }
        },
      }
    );
  };

  const handleOpenCounter = (subTask: SubTask) =>
    router.push({
      pathname: '/counter/[taskId]',
      params: { taskId: String(taskId), subTaskId: String(subTask.sub_task_id), date },
    });

  const handleOpenTimer = (subTask: SubTask) =>
    router.push({
      pathname: '/timer-task/[taskId]',
      params: { taskId: String(taskId), subTaskId: String(subTask.sub_task_id), date },
    });

  const handleIncrement = (subTask: SubTask, amount: number) => {
    incrementSubTask.mutate(
      { taskId, subTaskId: subTask.sub_task_id, amount, date },
      {
        onSuccess: (data) => {
          if (data.parent_status === 'completed' && data.parent_reward_text) {
            onRewardEarned?.(data.parent_reward_text);
          }
        },
      }
    );
  };

  return (
    <View style={[styles.container, { borderColor }]}>
      {pageRows.map((subTask) => (
        <SubTaskRow
          key={subTask.sub_task_id}
          subTask={subTask}
          disabled={disabled}
          onComplete={handleComplete}
          onIncrement={handleIncrement}
          onOpenCounter={handleOpenCounter}
          onOpenTimer={handleOpenTimer}
        />
      ))}

      {totalPages > 1 ? (
        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          onPrev={() => setPage(Math.max(1, currentPage - 1))}
          onNext={() => setPage(Math.min(totalPages, currentPage + 1))}
        />
      ) : null}

      {completedSubTasks.length > 0 ? (
        <View style={styles.completedSection}>
          <Pressable
            onPress={() => setCompletedExpanded((v) => !v)}
            hitSlop={8}
            style={styles.completedToggle}>
            <IconSymbol
              name={completedExpanded ? 'chevron.up' : 'chevron.down'}
              size={16}
              color={successColor}
            />
            <ThemedText type="defaultSemiBold" style={[styles.completedCount, { color: successColor }]}>
              {`${t('subtasks.completedSection')} (${completedSubTasks.length})`}
            </ThemedText>
          </Pressable>

          {completedExpanded
            ? completedSubTasks.map((subTask) => (
                <SubTaskRow
                  key={subTask.sub_task_id}
                  subTask={subTask}
                  disabled={disabled}
                  onComplete={handleComplete}
                  onIncrement={handleIncrement}
                  onOpenCounter={handleOpenCounter}
                  onOpenTimer={handleOpenTimer}
                />
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingTop: 10, gap: 10, marginTop: 4 },
  row: { gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { padding: 2 },
  title: { flex: 1, fontSize: 14 },
  subDescription: { fontSize: 13, lineHeight: 18 },
  strikethrough: { textDecorationLine: 'line-through' },
  counterControls: { gap: 8, paddingLeft: 28 },
  completedSection: { gap: 10 },
  completedToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  completedCount: { fontSize: 13 },
});
