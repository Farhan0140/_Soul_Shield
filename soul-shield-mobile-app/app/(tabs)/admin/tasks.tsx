import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { GlobalTaskRow } from '@/components/admin/global-task-row';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useDeleteTask } from '@/hooks/queries/use-task-mutations';
import { useTasksQuery } from '@/hooks/queries/use-tasks';
import { todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';

export default function AdminTasksScreen() {
  const today = todayISODate();
  const tasksQuery = useTasksQuery(today);
  const deleteTask = useDeleteTask(today);

  const globalTasks = useMemo(
    () => (tasksQuery.data ?? []).filter((task) => task.is_global),
    [tasksQuery.data]
  );

  const handleEdit = (task: Task) => {
    router.push({
      pathname: '/task/[id]/edit',
      params: { id: String(task.task_id), task: JSON.stringify(task) },
    });
  };

  const handleDelete = (task: Task) => {
    Alert.alert('Delete Fixed Task', `Delete "${task.title}" for all users?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteTask.mutate(task.task_id, {
            onError: (err) => Alert.alert('Could not delete task', getErrorMessage(err)),
          }),
      },
    ]);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <ThemedText type="title">Admin Panel</ThemedText>
      <ThemedText>Fixed tasks scheduled for today, across all users.</ThemedText>

      <PrimaryButton
        label="+ Create Fixed Task"
        onPress={() => router.push({ pathname: '/task/new', params: { global: 'true' } })}
      />

      {tasksQuery.isLoading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : tasksQuery.isError ? (
        <ErrorState message={getErrorMessage(tasksQuery.error)} onRetry={() => tasksQuery.refetch()} />
      ) : globalTasks.length === 0 ? (
        <EmptyState icon="shield.fill" title="No fixed tasks scheduled for today" />
      ) : (
        <View style={styles.list}>
          {globalTasks.map((task) => (
            <GlobalTaskRow
              key={task.task_id}
              task={task}
              onEdit={() => handleEdit(task)}
              onDelete={() => handleDelete(task)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 16 },
  list: { gap: 10 },
});
