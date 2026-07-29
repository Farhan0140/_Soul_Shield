import { useQuery } from '@tanstack/react-query';

import { getCategories } from '@/api/categories';
import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';

export function useCategoriesQuery() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => getCategories(token),
    enabled: !!token,
  });
}
