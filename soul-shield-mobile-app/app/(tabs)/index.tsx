import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { DateNavHeader } from '@/components/dashboard/date-nav-header';
import { ProgressSummaryBar } from '@/components/dashboard/progress-summary-bar';
import { SourceFilterRow, type SourceFilter } from '@/components/filters/source-filter';
import { StatusTabs, type StatusFilter } from '@/components/filters/status-tabs';
import { TaskTypeFilterRow, type TaskTypeFilter } from '@/components/filters/task-type-filter';
import { CategorySection } from '@/components/task/category-section';
import { RewardModal } from '@/components/task/reward-modal';
import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useAuth } from '@/context/auth-context';
import { useCategoriesQuery } from '@/hooks/queries/use-categories';
import { useCompleteTask, useDeleteTask } from '@/hooks/queries/use-task-mutations';
import { useTasksQuery } from '@/hooks/queries/use-tasks';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useTaskRemindersSync } from '@/hooks/use-task-reminders-sync';
import { useThemeColor } from '@/hooks/use-theme-color';
import { addDays, todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';

const FIXED_SECTION_KEY = 'fixed';
const UNCATEGORIZED_SECTION_KEY = 'uncategorized';
const COMPLETED_SECTION_KEY = 'completed';

export default function HomeScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [date, setDate] = useState(todayISODate());
  const [status, setStatus] = useState<StatusFilter>('all');
  const [taskType, setTaskType] = useState<TaskTypeFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  // Owned here rather than by TaskCard: completing a task moves its card from
  // an active section into the separate "Completed Tasks" section below,
  // which unmounts/remounts TaskCard in a new subtree — any modal state kept
  // there would be lost before the reward text ever showed up. This screen
  // never unmounts on that transition, so it's the stable place to hold it.
  const [reward, setReward] = useState<{ text: string; taskTitle: string } | null>(null);

  const tasksQuery = useTasksQuery(date);
  const { isOnline } = useNetworkStatus();
  const { data: categories = [] } = useCategoriesQuery();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask(date);
  useTaskRemindersSync();

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const categoryFallback = useThemeColor({}, 'categoryFallback');

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (status !== 'all' && task.status !== status) return false;
      if (taskType !== 'all' && task.task_type !== taskType) return false;
      if (source === 'fixed' && !task.is_global) return false;
      if (source === 'mine' && task.is_global) return false;
      return true;
    });
  }, [tasks, status, taskType, source]);

  // Completed tasks are pulled out of their normal category grouping into a
  // single dedicated section (see below) — every other section only ever
  // shows active (non-completed) tasks.
  const completedTasks = filteredTasks.filter((t) => t.status === 'completed');
  const activeTasks = filteredTasks.filter((t) => t.status !== 'completed');

  const fixedTasks = activeTasks.filter((t) => t.is_global);
  const myTasks = activeTasks.filter((t) => !t.is_global);

  const categorySections = useMemo(() => {
    const byCategory = new Map<number, Task[]>();
    const uncategorized: Task[] = [];
    for (const task of myTasks) {
      if (task.category_id == null) {
        uncategorized.push(task);
      } else {
        const list = byCategory.get(task.category_id);
        if (list) list.push(task);
        else byCategory.set(task.category_id, [task]);
      }
    }
    return [
      ...categories.map((cat) => ({
        key: String(cat.id),
        categoryId: cat.id as number | null,
        title: cat.name,
        accentColor: cat.color_hex,
        tasks: byCategory.get(cat.id) ?? [],
      })),
      {
        key: UNCATEGORIZED_SECTION_KEY,
        categoryId: null,
        title: 'Uncategorized',
        accentColor: categoryFallback,
        tasks: uncategorized,
      },
    ];
  }, [categories, myTasks, categoryFallback]);

  const hasActiveFilters = status !== 'all' || taskType !== 'all' || source !== 'all';

  const clearFilters = () => {
    setStatus('all');
    setTaskType('all');
    setSource('all');
  };

  const handleToggleComplete = (task: Task) => {
    completeTask.mutate(
      { taskId: task.task_id, date },
      {
        onSuccess: (data) => {
          if (data.status === 'completed' && data.reward_text) {
            setReward({ text: data.reward_text, taskTitle: task.title });
          }
        },
        onError: (err) => Alert.alert('Could not complete task', getErrorMessage(err)),
      }
    );
  };

  const handleRewardEarned = (task: Task, text: string) => {
    setReward({ text, taskTitle: task.title });
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
    <>
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
        <StatusTabs value={status} onChange={setStatus} />
        <TaskTypeFilterRow value={taskType} onChange={setTaskType} />
        <SourceFilterRow value={source} onChange={setSource} />
      </View>

      {tasksQuery.isPending && !isOnline ? (
        // Distinct from the isLoading skeleton below: with no connection and
        // nothing cached for this date, no fetch is actually in flight (it's
        // paused, not loading) and never will be until connectivity returns —
        // an indefinite spinner would be misleading, and falling through to
        // the empty-list view would look like "no tasks today" instead of
        // "not downloaded yet". Only today + the next couple of days are
        // pre-fetched for offline use (see lib/background-sync/sync.ts).
        <ErrorState message="You're offline and haven't downloaded tasks for this date yet. Connect to the internet to load them." />
      ) : tasksQuery.isLoading ? (
        <View style={styles.skeletons}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : tasksQuery.isError ? (
        <ErrorState message={getErrorMessage(tasksQuery.error)} onRetry={() => tasksQuery.refetch()} />
      ) : (
        <View style={styles.sections}>
          {/* Every section — real categories and the pseudo-categories below
           * (Fixed/Uncategorized/Completed) — opens its own dedicated page
           * instead of expanding inline; see category/[id].tsx for how it
           * derives Fixed/Uncategorized/Completed from useTasksQuery(date)
           * since those don't have a backend category to fetch. */}
          <CategorySection
            title="Fixed Tasks"
            count={fixedTasks.length}
            accentColor={tintColor}
            icon="shield.fill"
            tasks={fixedTasks}
            date={date}
            isAdmin={isAdmin}
            onPress={() =>
              router.push({
                pathname: '/category/[id]',
                params: { id: FIXED_SECTION_KEY, name: 'Fixed Tasks', date },
              })
            }
            onToggleComplete={handleToggleComplete}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRewardEarned={handleRewardEarned}
          />
          {categorySections.map((section) => (
            <CategorySection
              key={section.key}
              title={section.title}
              count={section.tasks.length}
              accentColor={section.accentColor}
              tasks={section.tasks}
              date={date}
              isAdmin={isAdmin}
              onPress={() =>
                router.push({
                  pathname: '/category/[id]',
                  params: {
                    id: section.categoryId != null ? String(section.categoryId) : UNCATEGORIZED_SECTION_KEY,
                    name: section.title,
                    date,
                  },
                })
              }
              onToggleComplete={handleToggleComplete}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRewardEarned={handleRewardEarned}
            />
          ))}
          {completedTasks.length > 0 ? (
            <CategorySection
              title="Completed Tasks"
              count={completedTasks.length}
              accentColor={successColor}
              icon="checkmark.circle.fill"
              tasks={completedTasks}
              date={date}
              isAdmin={isAdmin}
              showCategoryBadge
              onPress={() =>
                router.push({
                  pathname: '/category/[id]',
                  params: { id: COMPLETED_SECTION_KEY, name: 'Completed Tasks', date },
                })
              }
              onToggleComplete={handleToggleComplete}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : null}
        </View>
      )}
    </ScrollView>
    <RewardModal
      visible={!!reward}
      text={reward?.text ?? ''}
      taskTitle={reward?.taskTitle}
      onClose={() => setReward(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 16 },
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
  sections: { gap: 12 },
});
