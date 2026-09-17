import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { createCategoryLocal, softDeleteCategoryLocal, updateCategoryLocal, reorderCategoriesLocal } from '@/lib/db/categories-repo';
import { newUuid } from '@/lib/db/uuid';
import {
  createCategoryMutationFn,
  deleteCategoryMutationFn,
  reorderCategoriesMutationFn,
  updateCategoryMutationFn,
} from '@/lib/mutation-defaults';
import { mutationKeys } from '@/lib/mutation-keys';
import { queryKeys } from '@/lib/query-keys';

interface MutateOptions {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

function invalidateCategoryDependents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.categories });
  // category_name/category_color are denormalized onto every task by
  // deriveTasksForRange (lib/db/tasks-repo.ts) at read time, so a category
  // edit/delete is already reflected the moment these re-read from SQLite -
  // no separate task-list cache patch needed anymore (see below).
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.categories.create,
    mutationFn: createCategoryMutationFn,
    onSettled: () => invalidateCategoryDependents(queryClient),
  });

  const mutate = useCallback(
    (input: { name: string; color_hex?: string }, options?: MutateOptions) => {
      const uuid = newUuid();
      createCategoryLocal(uuid, { name: input.name, colorHex: input.color_hex ?? '#CCCCCC' });
      invalidateCategoryDependents(queryClient);
      mutation.mutate({ uuid }, { onSuccess: options?.onSuccess, onError: options?.onError });
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.categories.update,
    mutationFn: updateCategoryMutationFn,
    onSettled: () => invalidateCategoryDependents(queryClient),
  });

  const mutate = useCallback(
    ({ id, input }: { id: string; input: { name?: string; color_hex?: string } }, options?: MutateOptions) => {
      updateCategoryLocal(id, { name: input.name, colorHex: input.color_hex });
      invalidateCategoryDependents(queryClient);
      mutation.mutate({ uuid: id }, { onSuccess: options?.onSuccess, onError: options?.onError });
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

/** Reorders the caller's full category list. */
export function useReorderCategories() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.categories.reorder,
    mutationFn: reorderCategoriesMutationFn,
    onSettled: () => invalidateCategoryDependents(queryClient),
  });

  const mutate = useCallback(
    (orderedIds: string[], options?: MutateOptions) => {
      reorderCategoriesLocal(orderedIds);
      invalidateCategoryDependents(queryClient);
      mutation.mutate(orderedIds, { onError: options?.onError });
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.categories.delete,
    mutationFn: deleteCategoryMutationFn,
    onSettled: () => invalidateCategoryDependents(queryClient),
  });

  const mutate = useCallback(
    (id: string, options?: MutateOptions) => {
      softDeleteCategoryLocal(id);
      invalidateCategoryDependents(queryClient);
      mutation.mutate({ uuid: id }, { onError: options?.onError });
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}
