import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CounterProgressRing } from '@/components/counter/counter-progress-ring';
import { CounterTaskHeader } from '@/components/counter/counter-task-header';
import { ThemedText } from '@/components/themed-text';
import { RewardModal } from '@/components/task/reward-modal';
import { StatusBadge } from '@/components/task/status-badge';
import { TimerTaskControls } from '@/components/timer-task/timer-task-controls';
import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Fonts } from '@/constants/theme';
import { useTasksQuery } from '@/hooks/queries/use-tasks';
import { useTaskTimer } from '@/hooks/use-task-timer';
import { useThemeColor } from '@/hooks/use-theme-color';
import { isToday, todayISODate } from '@/lib/date';
import { formatRemaining } from '@/lib/timer/format';

/** Focused, single-task alternative to the task list — opened via the
 * "Start timer" link TaskCard/SubTaskList render for Timer Type Tasks/Sub-
 * Tasks, mirroring app/counter/[taskId].tsx. Unlike the counter page, the
 * actual countdown/completion logic lives entirely in useTaskTimer (see its
 * doc comment) — this screen only renders it and reuses the existing
 * circular progress ring in place of the Profile Timer's water/wave
 * background, per spec. */
export default function TimerTaskScreen() {
  const { taskId, subTaskId, date: dateParam } = useLocalSearchParams<{
    taskId: string;
    subTaskId?: string;
    date?: string;
  }>();
  const date = dateParam || todayISODate();
  const numericTaskId = Number(taskId);
  const isSubTask = !!subTaskId;

  const [reward, setReward] = useState<{ text: string; taskTitle: string } | null>(null);

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ringSize = Math.min(width * 0.72, 280);
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

  const title = isSubTask ? subTask?.title : task?.title;
  const durationSeconds = (isSubTask ? subTask?.duration_seconds : task?.duration_seconds) ?? 0;

  // Called unconditionally (rules of hooks) regardless of loading/validity
  // state below — only its *results* are used conditionally.
  const timer = useTaskTimer({
    taskId: numericTaskId,
    subTaskId: isSubTask ? Number(subTaskId) : null,
    date,
    durationSeconds,
    taskTitle: title ?? '',
    isSubTask,
    onRewardEarned: (text) => setReward({ text, taskTitle: title ?? '' }),
  });

  const isLoading = tasksQuery.isLoading;
  const isError = tasksQuery.isError;
  const notFound = !isLoading && !isError && (!task || (isSubTask && !subTask));
  const isTimerType = isSubTask
    ? subTask?.task_type === 'timer'
    : task?.task_type === 'timer' && !task?.sub_tasks?.length;
  const invalidType = !isLoading && !isError && task && (!isSubTask || subTask) && !isTimerType;

  const status = isSubTask ? subTask?.status : task?.status;
  const isMissed = isSubTask ? task?.status === 'missed' : status === 'missed';
  const isCompleted = status === 'completed';
  const isReadOnly = !isToday(date);
  const disabled = isReadOnly || isMissed || isCompleted;

  const description = isSubTask ? null : task?.description;
  const parentTitle = isSubTask ? task?.title : null;

  return (
    <View style={[styles.screen, { backgroundColor: background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <ThemedText type="defaultSemiBold" style={{ color: mutedColor }}>
          Timer
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
          <ErrorState message="This task doesn't have a dedicated timer page." />
        ) : (
          <>
            <CounterTaskHeader title={title ?? ''} description={description} parentTitle={parentTitle} />

            <View style={styles.ringSection}>
              <CounterProgressRing size={ringSize} progress={timer.progress} color={tintColor} trackColor={borderColor}>
                <ThemedText style={[styles.digits, { color: textColor, fontFamily: Fonts.mono }]}>
                  {formatRemaining(timer.remainingMs)}
                </ThemedText>
                <ThemedText style={[styles.remainingLabel, { color: mutedColor }]}>remaining</ThemedText>
              </CounterProgressRing>
              {isCompleted ? <StatusBadge label="Completed" tone="success" /> : null}
              {isMissed ? <StatusBadge label="Missed" tone="danger" /> : null}
            </View>

            <TimerTaskControls
              status={timer.status}
              disabled={disabled}
              onStart={timer.start}
              onPause={timer.pause}
              onResume={timer.resume}
            />
          </>
        )}
      </ScrollView>

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
  digits: { fontSize: 34, letterSpacing: 1, fontVariant: ['tabular-nums'] },
  remainingLabel: { fontSize: 13, marginTop: 4 },
});
