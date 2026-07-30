import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateMutation, defaultShouldDehydrateQuery } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'SOULSHIELD_QUERY_CACHE',
  throttleTime: 1000,
});

// Bump whenever a persisted query/mutation's data shape changes, to
// force-invalidate stale cache instead of shipping a runtime crash from a
// shape mismatch against old persisted data.
const PERSIST_BUSTER = 'v1';

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: PERSIST_BUSTER,
  dehydrateOptions: {
    // `me` is cached explicitly via SecureStore (see context/auth-context.tsx)
    // rather than through the generic persister, since auth bootstrap needs a
    // synchronously-available fallback that doesn't race the persister's async
    // restore.
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) && query.queryKey[0] !== 'me',
    // Paused mutations (queued while offline) must survive persistence so
    // they can be replayed after an app kill+relaunch.
    shouldDehydrateMutation: (mutation) =>
      defaultShouldDehydrateMutation(mutation) || mutation.state.isPaused,
  },
};
