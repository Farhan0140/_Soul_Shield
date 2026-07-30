import { useHeaderHeight } from '@react-navigation/elements';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { CategoryForm } from '@/components/categories/category-form';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { useCreateCategory } from '@/hooks/queries/use-category-mutations';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { getErrorMessage } from '@/lib/errors';

export default function NewCategoryScreen() {
  const headerHeight = useHeaderHeight();
  const { isOnline } = useNetworkStatus();
  const createCategory = useCreateCategory();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (input: { name: string; color_hex: string }) => {
    setError(null);
    createCategory.mutate(input, {
      onSuccess: () => router.back(),
      onError: (err) => setError(getErrorMessage(err)),
    });
    // Offline: the mutation queues silently rather than resolving, so don't
    // leave the form stuck on "saving" — it'll sync automatically once online.
    if (!isOnline) router.back();
  };

  return (
    <KeyboardAvoidingScrollView keyboardVerticalOffset={headerHeight} contentContainerStyle={styles.content}>
      <CategoryForm
        submitting={createCategory.isPending}
        error={error}
        submitLabel="Create Category"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20 },
});
