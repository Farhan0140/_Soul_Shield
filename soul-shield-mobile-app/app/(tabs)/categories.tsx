import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import type { Category } from '@/api/types';
import { CategoryForm } from '@/components/categories/category-form';
import { CategoryRow } from '@/components/categories/category-row';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useFabAction } from '@/context/fab-context';
import { useCategoriesQuery } from '@/hooks/queries/use-categories';
import {
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/queries/use-category-mutations';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { getErrorMessage } from '@/lib/errors';

type EditingState = 'new' | Category | null;

export default function CategoriesScreen() {
  const categoriesQuery = useCategoriesQuery();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { isOnline } = useNetworkStatus();

  const [editing, setEditing] = useState<EditingState>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = categoriesQuery.data ?? [];
  const isEditingExisting = editing !== null && editing !== 'new';

  useFabAction(editing === null ? () => setEditing('new') : null);

  const handleSubmit = (input: { name: string; color_hex: string }) => {
    setError(null);
    if (isEditingExisting) {
      updateCategory.mutate(
        { id: (editing as Category).id, input },
        {
          onSuccess: () => setEditing(null),
          onError: (err) => setError(getErrorMessage(err)),
        }
      );
    } else {
      createCategory.mutate(input, {
        onSuccess: () => setEditing(null),
        onError: (err) => setError(getErrorMessage(err)),
      });
    }
    // Offline: the mutation queues silently rather than resolving, so don't
    // leave the form stuck open — it'll sync automatically once online.
    if (!isOnline) setEditing(null);
  };

  const handleDelete = (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Tasks using "${category.name}" will become Uncategorized — they won't be deleted. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteCategory.mutate(category.id, {
              onError: (err) => Alert.alert('Could not delete category', getErrorMessage(err)),
            }),
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingScrollView contentContainerStyle={styles.content}>
      <ThemedText type="title">Categories</ThemedText>

      {editing !== null ? (
        <CategoryForm
          initialName={isEditingExisting ? (editing as Category).name : ''}
          initialColor={isEditingExisting ? (editing as Category).color_hex : undefined}
          submitting={createCategory.isPending || updateCategory.isPending}
          error={error}
          submitLabel={isEditingExisting ? 'Save Changes' : 'Create Category'}
          onSubmit={handleSubmit}
          onCancel={() => {
            setError(null);
            setEditing(null);
          }}
        />
      ) : null}

      {categoriesQuery.isLoading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : categoriesQuery.isError ? (
        <ErrorState
          message={getErrorMessage(categoriesQuery.error)}
          onRetry={() => categoriesQuery.refetch()}
        />
      ) : categories.length === 0 ? (
        <EmptyState
          icon="tag.fill"
          title="No categories found"
          message="Create a category to organize your tasks."
          actionLabel={editing === null ? 'Add Category' : undefined}
          onAction={editing === null ? () => setEditing('new') : undefined}
        />
      ) : (
        <View style={styles.list}>
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onEdit={() => setEditing(category)}
              onDelete={() => handleDelete(category)}
            />
          ))}
        </View>
      )}
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 100, gap: 20 },
  list: { gap: 10 },
});
