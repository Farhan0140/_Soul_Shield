import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CounterProgressRing } from '@/components/counter/counter-progress-ring';
import { CounterTaskHeader } from '@/components/counter/counter-task-header';
import { CustomIncrementModal } from '@/components/counter/custom-increment-modal';
import { MainIncrementButton } from '@/components/counter/main-increment-button';
import { QuickIncrementButtons } from '@/components/counter/quick-increment-buttons';
import { ThemedText } from '@/components/themed-text';
import { RewardModal } from '@/components/task/reward-modal';
import { StatusBadge } from '@/components/task/status-badge';
import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useTasksQuery } from '@/hooks/queries/use-tasks';
import { useIncrementSubTask } from '@/hooks/queries/use-task-mutations';
import { useTaskIncrementBuffer } from '@/hooks/use-task-increment-buffer';
import { useThemeColor } from '@/hooks/use-theme-color';
import { isToday, todayISODate } from '@/lib/date';
import { formatCompactNumber } from '@/lib/format';

/** Focused, single-task alternative to the inline counter in TaskCard/
 * SubTaskList — opened via the redirect icon those components render for
 * Counter Type Tasks/Sub-Tasks. Reads/writes the exact same
 * queryKeys.tasks(date) cache and mutations they use (useTaskIncrementBuffer
 * for a main counter task, useIncrementSubTask for a counter sub-task), so
 * this page and the task list stay in sync automatically — there is no
 * counter state that lives only here. */
export default function CounterTaskScreen() {
  const { taskId, subTaskId, date: dateParam } = useLocalSearchParams<{
    taskId: string;
    subTaskId?: string;
    date?: string;
  }>();
  const date = dateParam || todayISODate();
  const numericTaskId = Number(taskId);
  const isSubTask = !!subTaskId;

  const [reward, setReward] = useState<{ text: string; taskTitle: string } | null>(null);
  const [customModalVisible, setCustomModalVisible] = useState(false);

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ringSize = Math.min(width * 0.68, 260);
  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'border');

  const tasksQuery = useTasksQuery(date);

  const task = useMemo(
    () => tasksQuery.data?.find((t) => t.task_id === numericTaskId),
    [tasksQuery.data, numericTaskId]
  );
  const subTask = useMemo(
    () => (isSubTask ? task?.sub_tasks?.find((s) => s.sub_task_id === Number(subTaskId)) : undefined),
    [task, isSubTask, subTaskId]
  );

  // Hooks that own the actual counting logic are called unconditionally
  // (rules of hooks) regardless of loading/validity state below — only their
  // *results* are used conditionally. This is the identical hook TaskCard's
  // CounterTaskControls uses for a main counter task, so its debounced,
  // offline-safe buffering behaves exactly the same here.
  const buffer = useTaskIncrementBuffer({
    taskId: numericTaskId,
    date,
    serverProgressCount: !isSubTask ? task?.progress_count ?? 0 : 0,
    targetCount: !isSubTask ? task?.target_count ?? 0 : 0,
    onRewardEarned: (text) => setReward({ text, taskTitle: task?.title ?? '' }),
  });
  const incrementSubTask = useIncrementSubTask();

  const handleAdd = useCallback(
    (amount: number) => {
      if (isSubTask) {
        if (!task || !subTask) return;
        incrementSubTask.mutate(
          { taskId: task.task_id, subTaskId: subTask.sub_task_id, amount, date },
          {
            onSuccess: (data) => {
              if (data.parent_status === 'completed' && data.parent_reward_text) {
                setReward({ text: data.parent_reward_text, taskTitle: subTask.title });
              }
            },
          }
        );
      } else {
        buffer.addAmount(amount);
      }
    },
    [isSubTask, task, subTask, date, incrementSubTask, buffer]
  );

  const handleCustomConfirm = useCallback(
    (amount: number) => {
      handleAdd(amount);
      setCustomModalVisible(false);
    },
    [handleAdd]
  );

  const isLoading = tasksQuery.isLoading;
  const isError = tasksQuery.isError;
  const notFound = !isLoading && !isError && (!task || (isSubTask && !subTask));
  const isCounterType = isSubTask ? subTask?.task_type === 'counter' : task?.task_type === 'counter' && !task?.sub_tasks?.length;
  const invalidType = !isLoading && !isError && task && (!isSubTask || subTask) && !isCounterType;

  const status = isSubTask ? subTask?.status : task?.status;
  const isMissed = isSubTask ? task?.status === 'missed' : status === 'missed';
  const isCompleted = status === 'completed';
  const isReadOnly = !isToday(date);
  const disabled = isReadOnly || isMissed || (isSubTask && isCompleted);

  const targetCount = (isSubTask ? subTask?.target_count : task?.target_count) ?? 0;
  const currentCount = isSubTask ? subTask?.progress_count ?? 0 : buffer.displayProgress;
  const ratio = targetCount > 0 ? Math.min(currentCount / targetCount, 1) : 0;

  const title = isSubTask ? subTask?.title : task?.title;
  const description = isSubTask ? null : task?.description;
  const parentTitle = isSubTask ? task?.title : null;

  return (
    <View style={[styles.screen, { backgroundColor: background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <ThemedText type="defaultSemiBold" style={{ color: mutedColor }}>
          Counter
        </ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.closeButton}>
          <IconSymbol name="xmark" size={24} color={textColor} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <SkeletonCard />
        ) : isError ? (
          <ErrorState message="Could not load this task." onRetry={() => tasksQuery.refetch()} />
        ) : notFound ? (
          <ErrorState message="This task could not be found." />
        ) : invalidType ? (
          <ErrorState message="This task doesn't have a dedicated counter page." />
        ) : (
          <>
            <CounterTaskHeader title={title ?? ''} description={description} parentTitle={parentTitle} />

            <View style={styles.ringSection}>
              <CounterProgressRing size={ringSize} progress={ratio} color={tintColor} trackColor={borderColor}>
                <MainIncrementButton
                  size={ringSize * 0.66}
                  onPress={() => handleAdd(1)}
                  disabled={disabled}
                  color={tintColor}
                />
              </CounterProgressRing>
              <ThemedText style={[styles.progressLabel, { color: mutedColor }]}>
                {formatCompactNumber(currentCount)} / {formatCompactNumber(targetCount)}
              </ThemedText>
              {isCompleted ? <StatusBadge label="Completed" tone="success" /> : null}
              {isMissed ? <StatusBadge label="Missed" tone="danger" /> : null}
            </View>

            <QuickIncrementButtons
              onAdd={handleAdd}
              onCustom={() => setCustomModalVisible(true)}
              disabled={disabled}
            />
          </>
        )}
      </ScrollView>

      <CustomIncrementModal
        visible={customModalVisible}
        onClose={() => setCustomModalVisible(false)}
        onConfirm={handleCustomConfirm}
      />

      <RewardModal
        visible={!!reward}
        text={reward?.text ?? ''}
        taskTitle={reward?.taskTitle}
        onClose={() => setReward(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeButton: { padding: 4 },
  content: { flexGrow: 1, padding: 20, paddingTop: 8, paddingBottom: 60, gap: 28, alignItems: 'center' },
  ringSection: { alignItems: 'center', gap: 12 },
  progressLabel: { fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '600' },
});
