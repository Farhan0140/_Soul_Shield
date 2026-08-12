import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getTasksByCategory } from '@/api/tasks';
import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';

/** keepPreviousData so paging forward/back doesn't flash a loading skeleton
 * over the still-visible current page while the next one fetches. */
export function useCategoryTasksQuery(categoryId: number, date: string, page: number) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.categoryTasks(categoryId, date, page),
    queryFn: () => getTasksByCategory(categoryId, date, page, token),
    enabled: !!token,
    placeholderData: keepPreviousData,
  });
}
