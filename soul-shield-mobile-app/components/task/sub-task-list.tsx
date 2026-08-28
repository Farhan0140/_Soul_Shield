import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { SubTask } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { CounterProgressBar } from '@/components/task/counter-progress-bar';
import { QuickAddButtons } from '@/components/task/quick-add-buttons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCompleteSubTask, useIncrementSubTask } from '@/hooks/queries/use-task-mutations';
import { useThemeColor } from '@/hooks/use-theme-color';

interface SubTaskListProps {
  taskId: number;
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
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success');
  const borderColor = useThemeColor({}, 'border');
  const rowBackground = useThemeColor({}, 'background');
  const completeSubTask = useCompleteSubTask();
  const incrementSubTask = useIncrementSubTask();

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
      {subTasks.map((subTask) => {
        const isCompleted = subTask.status === 'completed';
        const isCounter = subTask.task_type === 'counter';
        const isTimer = subTask.task_type === 'timer';

        return (
          <View key={subTask.sub_task_id} style={[styles.row, { backgroundColor: rowBackground, borderColor }]}>
            <View style={styles.rowHeader}>
              {!isCounter && !isTimer ? (
                // TODO this button is for toggling completion of a normal type sub-task
                <Pressable
                  disabled={disabled}
                  onPress={() => handleComplete(subTask)}
                  hitSlop={8}
                  style={styles.checkbox}>
                  <IconSymbol
                    name={isCompleted ? 'checkmark.circle.fill' : 'circle'}
                    size={20}
                    color={isCompleted ? successColor : mutedColor}
                  />
                </Pressable>
              ) : null}
              <ThemedText style={[styles.title, isCompleted && styles.strikethrough]} numberOfLines={2}>
                {subTask.title}
              </ThemedText>
              {isCounter ? (
                // TODO this button is for opening the dedicated counter page for this sub-task
                <Pressable onPress={() => handleOpenCounter(subTask)} hitSlop={8}>
                  <IconSymbol name="arrow.up.right.square" size={16} color={mutedColor} />
                </Pressable>
              ) : null}
              {isTimer ? (
                // TODO this button is for opening the dedicated timer page for this sub-task
                <Pressable onPress={() => handleOpenTimer(subTask)} hitSlop={8}>
                  <IconSymbol name="arrow.up.right.square" size={16} color={mutedColor} />
                </Pressable>
              ) : null}
            </View>

            {isCounter ? (
              <View style={styles.counterControls}>
                <CounterProgressBar
                  progress={subTask.progress_count ?? 0}
                  target={subTask.target_count ?? 0}
                />
                <QuickAddButtons
                  disabled={disabled || isCompleted}
                  onAdd={(amount) => handleIncrement(subTask, amount)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingTop: 10, gap: 10, marginTop: 4 },
  row: { gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { padding: 2 },
  title: { flex: 1, fontSize: 14 },
  strikethrough: { textDecorationLine: 'line-through' },
  counterControls: { gap: 8, paddingLeft: 28 },
});
