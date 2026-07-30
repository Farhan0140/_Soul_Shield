import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { DateNavHeader } from '@/components/dashboard/date-nav-header';
import { ProgressSummaryBar } from '@/components/dashboard/progress-summary-bar';
import {
  ALL_CATEGORIES,
  CategoryChipRow,
  UNCATEGORIZED,
} from '@/components/filters/category-chip-row';
import { SourceFilterRow, type SourceFilter } from '@/components/filters/source-filter';
import { StatusTabs, type StatusFilter } from '@/components/filters/status-tabs';
import { TaskTypeFilterRow, type TaskTypeFilter } from '@/components/filters/task-type-filter';
import { TaskListSection } from '@/components/task/task-list-section';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useAuth } from '@/context/auth-context';
import { useFabAction } from '@/context/fab-context';
import { useCategoriesQuery } from '@/hooks/queries/use-categories';
import { useCompleteTask, useDeleteTask } from '@/hooks/queries/use-task-mutations';
import { useTasksQuery } from '@/hooks/queries/use-tasks';
import { useThemeColor } from '@/hooks/use-theme-color';
import { addDays, todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';

export default function HomeScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [date, setDate] = useState(todayISODate());
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [taskType, setTaskType] = useState<TaskTypeFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');

  const tasksQuery = useTasksQuery(date);
  const { data: categories = [] } = useCategoriesQuery();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask(date);

  useFabAction(() => router.push('/task/new'));

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (category === ALL_CATEGORIES) {
        // no-op
      } else if (category === UNCATEGORIZED) {
        if (task.category_id != null) return false;
      } else if (String(task.category_id) !== category) {
        return false;
      }
      if (status !== 'all' && task.status !== status) return false;
      if (taskType !== 'all' && task.task_type !== taskType) return false;
      if (source === 'fixed' && !task.is_global) return false;
      if (source === 'mine' && task.is_global) return false;
      return true;
    });
  }, [tasks, category, status, taskType, source]);

  const fixedTasks = filteredTasks.filter((t) => t.is_global);
  const myTasks = filteredTasks.filter((t) => !t.is_global);

  const hasActiveFilters =
    category !== ALL_CATEGORIES || status !== 'all' || taskType !== 'all' || source !== 'all';

  const clearFilters = () => {
    setCategory(ALL_CATEGORIES);
    setStatus('all');
    setTaskType('all');
    setSource('all');
  };

  const handleToggleComplete = (task: Task) => {
    completeTask.mutate(
      { taskId: task.task_id, date },
      { onError: (err) => Alert.alert('Could not complete task', getErrorMessage(err)) }
    );
  };

  const handleEdit = (task: Task) => {
    router.push({
      pathname: '/task/[id]/edit',
      params: { id: String(task.task_id), task: JSON.stringify(task) },
    });
  };

  const handleDelete = (task: Task) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
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
      <DateNavHeader
        date={date}
        onPrev={() => setDate((d) => addDays(d, -1))}
        onNext={() => setDate((d) => addDays(d, 1))}
        onToday={() => setDate(todayISODate())}
      />

      {tasks.length > 0 ? <ProgressSummaryBar completed={completedCount} total={tasks.length} /> : null}

      <View style={[styles.filters, { backgroundColor: cardColor, borderColor }]}>
        <View style={styles.filtersHeader}>
          <View style={styles.filtersHeaderLeft}>
            <IconSymbol name="line.3.horizontal.decrease" size={16} color={mutedColor} />
            <ThemedText type="defaultSemiBold" style={styles.filtersHeaderLabel}>
              Filters
            </ThemedText>
          </View>
          {hasActiveFilters ? (
            <Pressable onPress={clearFilters} hitSlop={8}>
              <ThemedText type="link" style={styles.clearLabel}>
                Clear
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        <CategoryChipRow categories={categories} selected={category} onSelect={setCategory} />
        <StatusTabs value={status} onChange={setStatus} />
        <TaskTypeFilterRow value={taskType} onChange={setTaskType} />
        <SourceFilterRow value={source} onChange={setSource} />
      </View>

      {tasksQuery.isLoading ? (
        <View style={styles.skeletons}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : tasksQuery.isError ? (
        <ErrorState message={getErrorMessage(tasksQuery.error)} onRetry={() => tasksQuery.refetch()} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="tray"
          title="No tasks scheduled for today."
          message="Add a new task to get started."
          actionLabel="Add Task"
          onAction={() => router.push('/task/new')}
        />
      ) : filteredTasks.length === 0 ? (
        <EmptyState icon="tray" title="No tasks match these filters." />
      ) : (
        <View style={styles.sections}>
          <TaskListSection
            title="Fixed Tasks"
            tasks={fixedTasks}
            date={date}
            canManage={isAdmin}
            onToggleComplete={handleToggleComplete}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          <TaskListSection
            title="My Tasks"
            tasks={myTasks}
            date={date}
            canManage
            onToggleComplete={handleToggleComplete}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 100, gap: 16 },
  filters: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  filtersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filtersHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filtersHeaderLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  clearLabel: { fontSize: 13 },
  skeletons: { gap: 12 },
  sections: { gap: 24 },
});
