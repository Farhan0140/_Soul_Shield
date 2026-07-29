import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { createCategory, deleteCategory, updateCategory } from '@/api/categories';
import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';

function invalidateCategoryDependents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.categories });
  // category_name/category_color are denormalized onto every task, so edits and
  // deletes must refresh already-cached task lists too (this is also how the
  // "revert to Uncategorized" behavior becomes visible without a manual refresh).
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
}

export function useCreateCategory() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color_hex?: string }) => createCategory(input, token),
    onSuccess: () => invalidateCategoryDependents(queryClient),
  });
}

export function useUpdateCategory() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: { name?: string; color_hex?: string } }) =>
      updateCategory(id, input, token),
    onSuccess: () => invalidateCategoryDependents(queryClient),
  });
}

export function useDeleteCategory() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id, token),
    onSuccess: () => invalidateCategoryDependents(queryClient),
  });
}
