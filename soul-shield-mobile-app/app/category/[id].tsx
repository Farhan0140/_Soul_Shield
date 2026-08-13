import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { RewardModal } from '@/components/task/reward-modal';
import { TaskCard } from '@/components/task/task-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useAuth } from '@/context/auth-context';
import { useCategoryTasksQuery } from '@/hooks/queries/use-category-tasks';
import { useCompleteTask, useDeleteTask } from '@/hooks/queries/use-task-mutations';
import { useTasksQuery } from '@/hooks/queries/use-tasks';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayDate, todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';

/** Pseudo-category keys used by the home screen for groupings that don't
 * come from the categories table (see app/(tabs)/index.tsx) - this screen
 * derives their task lists from the already-loaded useTasksQuery(date) list
 * instead of calling the (nonexistent) backend category endpoint for them. */
type SpecialCategoryId = 'fixed' | 'uncategorized' | 'completed';
const SPECIAL_CATEGORY_IDS: SpecialCategoryId[] = ['fixed', 'uncategorized', 'completed'];

/** Active tasks first, completed ones last - mirrors the backend's ordering
 * for real categories (see ListTasksByCategory) so pseudo-categories, built
 * client-side from the raw day's tasks, read the same way. Array.sort is
 * stable in modern JS engines, so each group keeps its original order. */
function sortActiveFirst(tasks: Task[]) {
  return [...tasks].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed'));
}

export default function CategoryDetailScreen() {
  const { id, name, date: dateParam } = useLocalSearchParams<{
    id: string;
    name: string;
    date?: string;
  }>();
  const specialId = SPECIAL_CATEGORY_IDS.includes(id as SpecialCategoryId)
    ? (id as SpecialCategoryId)
    : null;
  const categoryId = Number(id);
  const date = dateParam || todayISODate();

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [reward, setReward] = useState<{ text: string; taskTitle: string } | null>(null);

  const tasksQuery = useCategoryTasksQuery(categoryId, date, page, !specialId);
  const allTasksQuery = useTasksQuery(date, !!specialId);
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask(date);

  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');

  // For pseudo-categories, filter the full day's task list the same way the
  // home screen groups them (see categorySections/fixedTasks there).
  const specialTasks = useMemo(() => {
    if (!specialId) return [];
    const all = allTasksQuery.data ?? [];
    if (specialId === 'fixed') return all.filter((t) => t.is_global);
    if (specialId === 'uncategorized') return all.filter((t) => !t.is_global && t.category_id == null);
    return all.filter((t) => t.status === 'completed');
  }, [specialId, allTasksQuery.data]);

  const isLoading = specialId ? allTasksQuery.isLoading : tasksQuery.isLoading;
  const isError = specialId ? allTasksQuery.isError : tasksQuery.isError;
  const isSuccess = specialId ? allTasksQuery.isSuccess : tasksQuery.isSuccess;
  const queryError = specialId ? allTasksQuery.error : tasksQuery.error;
  const refetch = () => (specialId ? allTasksQuery.refetch() : tasksQuery.refetch());

  // Real categories get their sort (active tasks first, then completed) from
  // the backend already; pseudo-categories build their list client-side from
  // the raw day's tasks, so it's sorted the same way here. "Completed" is the
  // completed list itself, so there's nothing to reorder within it.
  const tasks = specialId
    ? specialId === 'completed'
      ? specialTasks
      : sortActiveFirst(specialTasks)
    : tasksQuery.data?.tasks ?? [];
  const totalItems = specialId ? specialTasks.length : tasksQuery.data?.total_items ?? 0;
  const completedItems = specialId
    ? specialTasks.filter((t) => t.status === 'completed').length
    : tasksQuery.data?.completed_items ?? 0;
  const totalPages = specialId ? 1 : tasksQuery.data?.total_pages ?? 1;

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
    <View style={[styles.screen, { backgroundColor: background }]}>
      {/* Belt-and-suspenders alongside category/_layout.tsx's Stack.Screen
       * options — co-locating it here too guarantees this route never shows
       * the native header/back button on top of the custom one below, even
       * if a parent layout's static options get out of sync after a change. */}
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTitle}>
          <ThemedText type="title" numberOfLines={2}>
            {name}
          </ThemedText>
          <ThemedText style={[styles.dateLabel, { color: mutedColor }]}>
            {formatDisplayDate(date)}
          </ThemedText>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.quitButton}>
          <IconSymbol name="xmark" size={24} color={textColor} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.skeletons}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError ? (
          <ErrorState message={getErrorMessage(queryError)} onRetry={refetch} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={specialId === 'completed' ? 'checkmark.circle.fill' : 'tag.fill'}
            title={specialId === 'completed' ? 'No completed tasks' : 'No tasks today'}
            message={
              specialId === 'completed'
                ? 'Nothing completed here yet today.'
                : 'This category has no tasks scheduled for today.'
            }
          />
        ) : (
          <View style={styles.list}>
            {tasks.map((task) => (
              <TaskCard
                key={task.task_id}
                task={task}
                date={date}
                isAdmin={isAdmin}
                showCategoryBadge={specialId === 'completed'}
                onToggleComplete={() => handleToggleComplete(task)}
                onEdit={() => handleEdit(task)}
                onDelete={() => handleDelete(task)}
                onRewardEarned={(text) => setReward({ text, taskTitle: task.title })}
              />
            ))}
          </View>
        )}

        {!specialId && isSuccess && tasks.length > 0 ? (
          <PaginationBar
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        ) : null}

        {isSuccess ? (
          <ThemedText style={[styles.totalLabel, { color: mutedColor }]}>
            {specialId === 'completed'
              ? `${totalItems} task${totalItems === 1 ? '' : 's'} completed`
              : `${totalItems} task${totalItems === 1 ? '' : 's'} total${
                  completedItems > 0 ? `, ${completedItems} completed` : ''
                }`}
          </ThemedText>
        ) : null}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { flex: 1, gap: 2 },
  dateLabel: { fontSize: 14 },
  quitButton: { padding: 4 },
  content: { flexGrow: 1, padding: 20, paddingTop: 0, gap: 16, paddingBottom: 120 },
  skeletons: { gap: 12 },
  list: { gap: 10 },
  totalLabel: { textAlign: 'center', fontSize: 13 },
});
