import { View, StyleSheet } from 'react-native';

import type { Task } from '@/api/types';
import { CounterProgressBar } from '@/components/task/counter-progress-bar';
import { QuickAddButtons } from '@/components/task/quick-add-buttons';
import { useTaskIncrementBuffer } from '@/hooks/use-task-increment-buffer';

interface CounterTaskControlsProps {
  task: Task;
  date: string;
  disabled?: boolean;
  accentColor?: string;
  onRewardEarned?: (text: string) => void;
}

export function CounterTaskControls({
  task,
  date,
  disabled,
  accentColor,
  onRewardEarned,
}: CounterTaskControlsProps) {
  const { displayProgress, addAmount } = useTaskIncrementBuffer({
    taskId: task.task_id,
    date,
    serverProgressCount: task.progress_count ?? 0,
    targetCount: task.target_count ?? 0,
    onRewardEarned,
  });

  return (
    <View style={styles.container}>
      <CounterProgressBar progress={displayProgress} target={task.target_count ?? 0} color={accentColor} />
      <QuickAddButtons onAdd={addAmount} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
});
