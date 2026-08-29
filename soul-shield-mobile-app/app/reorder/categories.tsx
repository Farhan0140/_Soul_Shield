import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import type { Category } from '@/api/types';
import { ReorderRow } from '@/components/reorder/reorder-row';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useCategoriesQuery } from '@/hooks/queries/use-categories';
import { useReorderCategories } from '@/hooks/queries/use-category-mutations';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getErrorMessage } from '@/lib/errors';

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function ReorderCategoriesScreen() {
  const categoriesQuery = useCategoriesQuery();
  const reorderCategories = useReorderCategories();
  const { isOnline } = useNetworkStatus();
  const mutedColor = useThemeColor({}, 'muted');
  const insets = useSafeAreaInsets();

  // Local copy the arrow buttons mutate freely; resynced whenever the
  // underlying query data changes. Saving is an explicit action, not
  // implicit on every tap, so this can safely diverge from the query data
  // until the user taps Save.
  const [items, setItems] = useState<Category[]>(categoriesQuery.data ?? []);
  const [savedOrder, setSavedOrder] = useState<number[]>((categoriesQuery.data ?? []).map((c) => c.id));
  useEffect(() => {
    setItems(categoriesQuery.data ?? []);
    setSavedOrder((categoriesQuery.data ?? []).map((c) => c.id));
  }, [categoriesQuery.data]);

  const isDirty = items.some((item, index) => item.id !== savedOrder[index]);

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => swap(current, index, target));
  };

  const handleSave = () => {
    // useReorderCategories optimistically writes the new order into the
    // categories query on mutate, which flows back through the effect above
    // and clears isDirty - no separate local bookkeeping needed here.
    reorderCategories.mutate(items.map((c) => c.id));
  };

  if (categoriesQuery.isLoading) {
    return (
      <View style={styles.content}>
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }
  if (categoriesQuery.isError) {
    return (
      <ErrorState
        message={getErrorMessage(categoriesQuery.error)}
        onRetry={() => categoriesQuery.refetch()}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon="tag.fill"
        title="No categories yet"
        message="Create a category first to reorder it here."
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.hint, { color: mutedColor }]}>
          Use the arrows to move a category up or down, then tap Save.
        </ThemedText>
        {items.map((category, index) => (
          <Animated.View key={category.id} layout={LinearTransition.duration(220)}>
            <ReorderRow
              title={category.name}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onMoveUp={() => moveItem(index, -1)}
              onMoveDown={() => moveItem(index, 1)}
            />
          </Animated.View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {!isOnline && reorderCategories.isPaused ? (
          <ThemedText style={[styles.hint, styles.queuedHint, { color: mutedColor }]}>
            You&apos;re offline - this order is saved and will sync once you&apos;re back online.
          </ThemedText>
        ) : null}
        <PrimaryButton
          label="Save"
          onPress={handleSave}
          // A mutation queued while offline sits "pending" (isPaused) until
          // reconnect - the optimistic update above already clears isDirty
          // the moment it's queued, so there's nothing to spin on.
          loading={reorderCategories.isPending && !reorderCategories.isPaused}
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
  footer: { paddingHorizontal: 20, paddingTop: 12 },
});
