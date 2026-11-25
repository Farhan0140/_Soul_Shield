import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useLocale } from '@/context/locale-context';
import { useAddTaskToMyTasks, useCompleteTask, useDeleteTask } from '@/hooks/queries/use-task-mutations';
import { useTasksQuery } from '@/hooks/queries/use-tasks';
import { useScreenReady } from '@/hooks/use-screen-ready';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useSurface } from '@/hooks/use-ui-style';
import { getGlobalCategoryRefs, type GlobalCategoryRef } from '@/lib/background-sync/pull-global';
import { formatDisplayDate, todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';
import { groupFixedTasksByCategory } from '@/lib/group-fixed-tasks';

/** Pseudo-category keys used by the home screen for groupings that don't
 * come from the categories table (see app/(tabs)/index.tsx) - this screen
 * derives their task lists from the already-loaded useTasksQuery(date) list
 * instead of calling a backend category endpoint for them. Real categories
 * are derived from that exact same list too (filtered by category_id) —
 * there's no separate per-category backend call for either kind any more,
 * which is what keeps this screen fully usable offline: the day's full task
 * list is the one thing the app already guarantees is prefetched (see
 * lib/background-sync/sync.ts), so every grouping built from it inherits
 * that guarantee for free. */
type SpecialCategoryId = 'fixed' | 'uncategorized' | 'completed';
const SPECIAL_CATEGORY_IDS: SpecialCategoryId[] = ['fixed', 'uncategorized', 'completed'];

/** Matches the page size the backend's now-retired /categories/:id/tasks
 * endpoint used to paginate with, so real categories keep the same page
 * length as before now that pagination happens client-side instead. */
const CATEGORY_PAGE_SIZE = 10;

/** Active tasks first, completed ones last - mirrors the backend's ordering
 * for real categories (see ListTasksByCategory) so every grouping built
 * client-side from the raw day's tasks reads the same way. Array.sort is
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
  const categoryId = id;
  const date = dateParam || todayISODate();

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [reward, setReward] = useState<{ text: string; taskTitle: string } | null>(null);
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);

  const tasksQuery = useTasksQuery(date);
  // Stable mutate functions only - see app/(tabs)/index.tsx.
  const { mutate: completeTaskMutate } = useCompleteTask();
  const { mutate: deleteTaskMutate } = useDeleteTask(date);
  const { mutate: addToMyTasksMutate } = useAddTaskToMyTasks(date);

  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');
  const surface = useSurface();
  const { t } = useLocale();

  // Fixed Tasks: shown grouped by the admin's categories, each collapsible.
  // Their names come from the public fixed-task pull (the admin's
  // categories aren't in the user's own data).
  const [fixedCategoryRefs, setFixedCategoryRefs] = useState<Record<string, GlobalCategoryRef>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (specialId === 'fixed') getGlobalCategoryRefs().then(setFixedCategoryRefs);
  }, [specialId]);

  // Every grouping this screen can show — the three pseudo-categories and a
  // real category alike — is filtered client-side from the same day's full
  // task list (see the doc comment on SpecialCategoryId above for why).
  const categoryTasks = useMemo(() => {
    const all = tasksQuery.data ?? [];
    if (specialId === 'fixed') return all.filter((t) => t.is_global && !t.already_added);
    if (specialId === 'uncategorized') return all.filter((t) => !t.is_global && t.category_id == null);
    if (specialId === 'completed') return all.filter((t) => t.status === 'completed');
    return all.filter((t) => t.category_id === categoryId);
  }, [specialId, categoryId, tasksQuery.data]);

  // Header shows on the tap; the task cards render once the screen has
  // slid in (see hooks/use-screen-ready.ts), with skeletons until then.
  const screenReady = useScreenReady();
  const isLoading = tasksQuery.isLoading || !screenReady;
  const isError = tasksQuery.isError;
  const isSuccess = tasksQuery.isSuccess;
  const queryError = tasksQuery.error;
  const refetch = () => tasksQuery.refetch();

  // "Completed" is the completed list itself, so there's nothing to reorder
  // within it; every other grouping sorts active tasks first (mirrors the
  // ordering the backend used to apply for real categories specifically —
  // now applied uniformly here since every grouping shares one source).
  const sortedTasks = specialId === 'completed' ? categoryTasks : sortActiveFirst(categoryTasks);

  const totalItems = sortedTasks.length;
  const completedItems = sortedTasks.filter((t) => t.status === 'completed').length;
  // Pseudo-categories were never paginated (a single day's fixed/
  // uncategorized/completed list is small enough to show in full); real
  // categories keep the same page size the backend used to paginate with,
  // now sliced client-side instead of fetched page-by-page.
  const totalPages = specialId ? 1 : Math.max(1, Math.ceil(totalItems / CATEGORY_PAGE_SIZE));
  const tasks = specialId
    ? sortedTasks
    : sortedTasks.slice((page - 1) * CATEGORY_PAGE_SIZE, page * CATEGORY_PAGE_SIZE);

  const fixedGroups = useMemo(
    () => (specialId === 'fixed' ? groupFixedTasksByCategory(tasks, fixedCategoryRefs) : []),
    [specialId, tasks, fixedCategoryRefs],
  );
  // With a single group there's nothing to browse - show it open.
  const isGroupExpanded = (groupKey: string) => fixedGroups.length === 1 || expandedGroups.has(groupKey);
  const toggleGroup = (groupKey: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });

  const handleToggleComplete = (task: Task) => {
    completeTaskMutate(
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
          deleteTaskMutate(task.task_id, {
            onError: (err) => Alert.alert('Could not delete task', getErrorMessage(err)),
          }),
      },
    ]);
  };

  const renderTaskCard = (task: Task) => (
    <TaskCard
      key={task.task_id}
      task={task}
      date={date}
      isAdmin={isAdmin}
      showCategoryBadge={specialId === 'completed'}
      variant={specialId === 'fixed' ? 'template' : undefined}
      alreadyAdded={task.already_added}
      isAdding={addingTaskId === task.task_id}
      onAddToMyTasks={() => handleAddToMyTasks(task)}
      onToggleComplete={() => handleToggleComplete(task)}
      onEdit={() => handleEdit(task)}
      onDelete={() => handleDelete(task)}
      onRewardEarned={(text) => setReward({ text, taskTitle: task.title })}
    />
  );

  const handleAddToMyTasks = (task: Task) => {
    setAddingTaskId(task.task_id);
    addToMyTasksMutate(task.task_id, {
      onError: (err) => Alert.alert('Could not add task', getErrorMessage(err)),
      onSettled: () => setAddingTaskId(null),
    });
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
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={10} style={styles.quitButton}>
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
        ) : specialId === 'fixed' ? (
          <View style={styles.list}>
            {fixedGroups.map((group) => {
              const groupKey = group.key ?? '__none__';
              const expanded = isGroupExpanded(groupKey);
              const groupName = group.name ?? t('home.section.uncategorized');
              const accent = group.color ?? tintColor;
              return (
                <View key={groupKey} style={styles.group}>
                  <Pressable
                    onPress={() => toggleGroup(groupKey)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`${groupName}, ${group.tasks.length}`}
                    style={({ pressed }) => [
                      styles.groupHeader,
                      { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 },
                      surface('card'),
                    ]}>
                    <View style={[styles.groupDot, { backgroundColor: accent }]} />
                    <ThemedText type="defaultSemiBold" style={styles.groupName} numberOfLines={1}>
                      {groupName}
                    </ThemedText>
                    <View style={[styles.groupCount, { backgroundColor: `${accent}22` }]}>
                      <ThemedText style={[styles.groupCountText, { color: accent }]}>{group.tasks.length}</ThemedText>
                    </View>
                    <IconSymbol name={expanded ? 'chevron.up' : 'chevron.down'} size={22} color={mutedColor} />
                  </Pressable>
                  {expanded ? <View style={styles.groupTasks}>{group.tasks.map((task) => renderTaskCard(task))}</View> : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.list}>{tasks.map((task) => renderTaskCard(task))}</View>
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
  group: { gap: 10 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  groupDot: { width: 10, height: 10, borderRadius: 5 },
  groupName: { flex: 1 },
  groupCount: { minWidth: 26, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignItems: 'center' },
  groupCountText: { fontSize: 13, fontWeight: '700' },
  groupTasks: { gap: 10, paddingLeft: 8 },
  totalLabel: { textAlign: 'center', fontSize: 13 },
});
