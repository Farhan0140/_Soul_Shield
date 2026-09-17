import { useQuery } from '@tanstack/react-query';

import { getCategories } from '@/api/categories';
import { useAuth } from '@/context/auth-context';
import { deriveCategories } from '@/lib/db/categories-repo';
import { getLocalDb } from '@/lib/db/client';
import { queryKeys } from '@/lib/query-keys';

/** Local-first read with a network fallback for when the local database
 * isn't available yet - see hooks/queries/use-tasks.ts's useTasksQuery for
 * the full reasoning (identical here, including the networkMode override -
 * a local SQLite read must run even while the device is reported offline). */
export function useCategoriesQuery() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => (getLocalDb() ? deriveCategories() : getCategories(token)),
    enabled: !!token,
    networkMode: getLocalDb() ? 'always' : 'online',
  });
}
