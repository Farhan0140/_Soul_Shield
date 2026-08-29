import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import type { ManageableSubTask, SubTaskInput } from '@/api/types';
import { ReorderRow } from '@/components/reorder/reorder-row';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useReorderMySubTasks } from '@/hooks/queries/use-task-mutations';
import { useMyTasksQuery } from '@/hooks/queries/use-tasks';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getErrorMessage } from '@/lib/errors';

function toSubTaskInput(s: ManageableSubTask): SubTaskInput {
  return {
    id: s.sub_task_id,
    title: s.title,
    task_type: s.task_type,
    target_count: s.target_count ?? undefined,
    duration_seconds: s.duration_seconds ?? undefined,
  };
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function ReorderSubTasksScreen() {
  const myTasksQuery = useMyTasksQuery();
  const { isOnline } = useNetworkStatus();
  const cardColor = useThemeColor({}, 'card');
  const mutedColor = useThemeColor({}, 'muted');
  const insets = useSafeAreaInsets();

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [items, setItems] = useState<ManageableSubTask[]>([]);
  // Order last confirmed with the server (or, while offline, last queued
  // optimistically) for the current task - useReorderMySubTasks writes the
  // new order into the myTasks query on mutate, so this flows back through
  // the effect below and clears isDirty even before the mutation actually
  // reaches the server, which is what keeps a reorder queued offline visibly
  // "saved" instead of looking reverted if this screen unmounts and remounts
  // before reconnecting.
  const [savedOrder, setSavedOrder] = useState<number[]>([]);

  // Only tasks that already have sub-tasks are worth picking here.
  const tasksWithSubTasks = useMemo(
    () => (myTasksQuery.data ?? []).filter((t) => (t.sub_tasks?.length ?? 0) > 0),
    [myTasksQuery.data]
  );

  // Local copy the arrow buttons mutate freely; resynced whenever the picked
  // task or the underlying data changes.
  useEffect(() => {
    if (selectedTaskId === null) return;
    const task = (myTasksQuery.data ?? []).find((t) => t.id === selectedTaskId);
    const subTasks = task?.sub_tasks ?? [];
    setItems(subTasks);
    setSavedOrder(subTasks.map((s) => s.sub_task_id));
  }, [selectedTaskId, myTasksQuery.data]);

  const isDirty = items.some((item, index) => item.sub_task_id !== savedOrder[index]);

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => swap(current, index, target));
  };

  // Reordering sub-tasks isn't a separate backend concept — it's the same
  // PATCH /tasks/{id} the task edit form already uses, just resubmitting the
  // whole sub_tasks array in its new order (repo.SubTaskRepo.ReplaceForParent
  // assigns position from array order).
  const reorderSubTasks = useReorderMySubTasks();

  const handleSave = () => {
    if (selectedTaskId === null) return;
    reorderSubTasks.mutate({
      id: selectedTaskId,
      input: { sub_tasks: items.map(toSubTaskInput) },
    });
  };

  if (myTasksQuery.isLoading) {
    return (
      <View style={styles.content}>
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }
  if (myTasksQuery.isError) {
    return (
      <ErrorState message={getErrorMessage(myTasksQuery.error)} onRetry={() => myTasksQuery.refetch()} />
    );
  }

  if (selectedTaskId === null) {
    if (tasksWithSubTasks.length === 0) {
      return (
        <EmptyState
          icon="list.bullet"
          title="No tasks with sub-tasks"
          message="Add sub-tasks to a task first to reorder them here."
        />
      );
    }
    return (
      <View style={styles.content}>
        <ThemedText style={[styles.hint, { color: mutedColor }]}>
          Pick a task to reorder its sub-tasks.
        </ThemedText>
        {tasksWithSubTasks.map((task) => (
          <Pressable
            key={task.id}
            onPress={() => setSelectedTaskId(task.id)}
            style={({ pressed }) => [styles.pickRow, { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="defaultSemiBold" style={styles.pickLabel} numberOfLines={1}>
              {task.title}
            </ThemedText>
            <ThemedText style={{ color: mutedColor }}>{task.sub_tasks?.length}</ThemedText>
            <IconSymbol name="chevron.right" size={18} color={mutedColor} />
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => setSelectedTaskId(null)} style={styles.backRow} hitSlop={8}>
          <IconSymbol name="chevron.left" size={18} color={mutedColor} />
          <ThemedText style={{ color: mutedColor }}>Tasks</ThemedText>
        </Pressable>
        <ThemedText style={[styles.hint, { color: mutedColor }]}>
          Use the arrows to move a sub-task up or down, then tap Save.
        </ThemedText>
        {items.map((subTask, index) => (
          <Animated.View key={subTask.sub_task_id} layout={LinearTransition.duration(220)}>
            <ReorderRow
              title={subTask.title}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onMoveUp={() => moveItem(index, -1)}
              onMoveDown={() => moveItem(index, 1)}
            />
          </Animated.View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {!isOnline && reorderSubTasks.isPaused ? (
          <ThemedText style={[styles.hint, styles.queuedHint, { color: mutedColor }]}>
            You&apos;re offline - this order is saved and will sync once you&apos;re back online.
          </ThemedText>
        ) : null}
        <PrimaryButton
          label="Save"
          onPress={handleSave}
          // See app/reorder/tasks.tsx's equivalent comment - a paused
          // offline mutation shouldn't spin forever; the optimistic update
          // already cleared isDirty the moment it was queued.
          loading={reorderSubTasks.isPending && !reorderSubTasks.isPaused}
          disabled={!isDirty}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 12 },
  hint: { fontSize: 13 },
  queuedHint: { textAlign: 'center', marginBottom: 8 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  pickLabel: { flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
});
