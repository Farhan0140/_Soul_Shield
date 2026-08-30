import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import type { ManageableTask } from '@/api/types';
import { ReorderRow } from '@/components/reorder/reorder-row';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useCategoriesQuery } from '@/hooks/queries/use-categories';
import { useReorderMyTasks } from '@/hooks/queries/use-task-mutations';
import { useMyTasksQuery } from '@/hooks/queries/use-tasks';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getErrorMessage } from '@/lib/errors';

/** Sentinel selection for the "Uncategorized" group — distinct from `null`,
 * which instead means "no group picked yet" (the picker step). */
const UNCATEGORIZED = 'uncategorized';
type Selection = number | typeof UNCATEGORIZED;

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function ReorderTasksScreen() {
  const categoriesQuery = useCategoriesQuery();
  const myTasksQuery = useMyTasksQuery();
  const { isOnline } = useNetworkStatus();
  const cardColor = useThemeColor({}, 'card');
  const mutedColor = useThemeColor({}, 'muted');
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState<Selection | null>(null);
  const [items, setItems] = useState<ManageableTask[]>([]);
  // Order last confirmed with the server (or, while offline, last queued
  // optimistically) for the current group - useReorderMyTasks writes the new
  // order into the myTasks query on mutate, so this flows back through the
  // effect below and clears isDirty even before the mutation actually reaches
  // the server, which is what keeps a reorder queued offline visibly "saved"
  // instead of looking reverted if this screen unmounts and remounts before
  // reconnecting.
  const [savedOrder, setSavedOrder] = useState<number[]>([]);

  const groups = useMemo(() => {
    const tasks = myTasksQuery.data ?? [];
    const categories = categoriesQuery.data ?? [];
    return {
      byCategory: categories.map((c) => ({
        id: c.id,
        name: c.name,
        count: tasks.filter((t) => t.category_id === c.id).length,
      })),
      uncategorizedCount: tasks.filter((t) => t.category_id == null).length,
    };
  }, [myTasksQuery.data, categoriesQuery.data]);

  // Local copy the arrow buttons mutate freely; resynced whenever the picked
  // group or the underlying data changes.
  useEffect(() => {
    if (selected === null) return;
    const tasks = myTasksQuery.data ?? [];
    const filtered =
      selected === UNCATEGORIZED
        ? tasks.filter((t) => t.category_id == null)
        : tasks.filter((t) => t.category_id === selected);
    const sorted = [...filtered].sort((a, b) => a.position - b.position);
    setItems(sorted);
    setSavedOrder(sorted.map((t) => t.id));
  }, [selected, myTasksQuery.data]);

  const isDirty = items.some((item, index) => item.id !== savedOrder[index]);

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => swap(current, index, target));
  };

  const reorderTasks = useReorderMyTasks();

  const handleSave = () => {
    reorderTasks.mutate({
      categoryId: selected === UNCATEGORIZED ? null : (selected as number),
      orderedIds: items.map((t) => t.id),
    });
  };

  if (myTasksQuery.isLoading || categoriesQuery.isLoading) {
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

  if (selected === null) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.hint, { color: mutedColor }]}>
          Pick a category to reorder its tasks.
        </ThemedText>
        <Pressable
          onPress={() => setSelected(UNCATEGORIZED)}
          style={({ pressed }) => [styles.pickRow, { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText type="defaultSemiBold" style={styles.pickLabel}>
            Uncategorized
          </ThemedText>
          <ThemedText style={{ color: mutedColor }}>{groups.uncategorizedCount}</ThemedText>
          <IconSymbol name="chevron.right" size={18} color={mutedColor} />
        </Pressable>
        {groups.byCategory.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setSelected(c.id)}
            style={({ pressed }) => [styles.pickRow, { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="defaultSemiBold" style={styles.pickLabel} numberOfLines={1}>
              {c.name}
            </ThemedText>
            <ThemedText style={{ color: mutedColor }}>{c.count}</ThemedText>
            <IconSymbol name="chevron.right" size={18} color={mutedColor} />
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => setSelected(null)} style={styles.backRow} hitSlop={8}>
          <IconSymbol name="chevron.left" size={18} color={mutedColor} />
          <ThemedText style={{ color: mutedColor }}>Categories</ThemedText>
        </Pressable>
        {items.length === 0 ? (
          <EmptyState icon="checklist" title="No tasks here" message="This group has no tasks to reorder." />
        ) : (
          <>
            <ThemedText style={[styles.hint, { color: mutedColor }]}>
              Use the arrows to move a task up or down, then tap Save.
            </ThemedText>
            {items.map((task, index) => (
              <Animated.View key={task.id} layout={LinearTransition.duration(220)}>
                <ReorderRow
                  title={task.title}
                  canMoveUp={index > 0}
                  canMoveDown={index < items.length - 1}
                  onMoveUp={() => moveItem(index, -1)}
                  onMoveDown={() => moveItem(index, 1)}
                />
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
      {items.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {!isOnline && reorderTasks.isPaused ? (
            <ThemedText style={[styles.hint, styles.queuedHint, { color: mutedColor }]}>
              You&apos;re offline - this order is saved and will sync once you&apos;re back online.
            </ThemedText>
          ) : null}
          <PrimaryButton
            label="Save"
            onPress={handleSave}
            // A mutation queued while offline sits "pending" (isPaused) until
            // reconnect - the optimistic update above already clears isDirty
            // the moment it's queued, so there's nothing to spin on; showing
            // a spinner here would just look stuck for however long the
            // device stays offline.
            loading={reorderTasks.isPending && !reorderTasks.isPaused}
            disabled={!isDirty}
          />
        </View>
      ) : null}
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
