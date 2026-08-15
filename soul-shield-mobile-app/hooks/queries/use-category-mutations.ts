import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { Category, Task } from '@/api/types';
import {
  createCategoryMutationFn,
  deleteCategoryMutationFn,
  updateCategoryMutationFn,
} from '@/lib/mutation-defaults';
import { mutationKeys } from '@/lib/mutation-keys';
import { queryKeys } from '@/lib/query-keys';

function invalidateCategoryDependents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.categories });
  // category_name/category_color are denormalized onto every task, so edits and
  // deletes must refresh already-cached task lists too (this is also how the
  // "revert to Uncategorized" behavior becomes visible without a manual refresh).
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
}

interface TaskListSnapshot {
  queryKey: readonly unknown[];
  data: Task[];
}

function snapshotTaskQueries(queryClient: QueryClient): TaskListSnapshot[] {
  const snapshots: TaskListSnapshot[] = [];
  for (const prefix of [['tasks'], ['taskHistory']]) {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: prefix })) {
      const data = query.state.data as Task[] | undefined;
      if (data) snapshots.push({ queryKey: query.queryKey, data });
    }
  }
  return snapshots;
}

function restoreTaskQueries(queryClient: QueryClient, snapshots: TaskListSnapshot[]) {
  snapshots.forEach(({ queryKey, data }) => queryClient.setQueryData(queryKey, data));
}

function patchTasksForCategory(
  queryClient: QueryClient,
  categoryId: number,
  patch: Partial<Pick<Task, 'category_id' | 'category_name' | 'category_color'>>
) {
  for (const prefix of [['tasks'], ['taskHistory']]) {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: prefix })) {
      queryClient.setQueryData<Task[]>(query.queryKey, (old) =>
        old?.map((t) => (t.category_id === categoryId ? { ...t, ...patch } : t))
      );
    }
  }
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.categories.create,
    mutationFn: createCategoryMutationFn,
    onSuccess: () => invalidateCategoryDependents(queryClient),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.categories.update,
    mutationFn: updateCategoryMutationFn,
    onMutate: async ({ id, input }: { id: number; input: { name?: string; color_hex?: string } }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });
      const previousCategories = queryClient.getQueryData<Category[]>(queryKeys.categories);
      queryClient.setQueryData<Category[]>(queryKeys.categories, (old) =>
        old?.map((c) => (c.id === id ? { ...c, ...input } : c))
      );

      const previousTaskLists = snapshotTaskQueries(queryClient);
      patchTasksForCategory(queryClient, id, {
        ...(input.name !== undefined ? { category_name: input.name } : {}),
        ...(input.color_hex !== undefined ? { category_color: input.color_hex } : {}),
      });

      return { previousCategories, previousTaskLists };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(queryKeys.categories, context.previousCategories);
      }
      if (context?.previousTaskLists) restoreTaskQueries(queryClient, context.previousTaskLists);
    },
    onSettled: () => invalidateCategoryDependents(queryClient),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.categories.delete,
    mutationFn: deleteCategoryMutationFn,
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });
      const previousCategories = queryClient.getQueryData<Category[]>(queryKeys.categories);
      queryClient.setQueryData<Category[]>(queryKeys.categories, (old) =>
        old?.filter((c) => c.id !== id)
      );

      const previousTaskLists = snapshotTaskQueries(queryClient);
      patchTasksForCategory(queryClient, id, {
        category_id: null,
        category_name: null,
        category_color: null,
      });

      return { previousCategories, previousTaskLists };
    },
    onError: (_err, _id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(queryKeys.categories, context.previousCategories);
      }
      if (context?.previousTaskLists) restoreTaskQueries(queryClient, context.previousTaskLists);
    },
    onSettled: () => invalidateCategoryDependents(queryClient),
  });
}
