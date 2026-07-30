import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchMe, login as apiLogin } from '@/api/auth';
import type { User } from '@/api/types';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { ApiError } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { setUnauthorizedHandler } from '@/lib/query-client';
import { cachedUserStore, tokenStore } from '@/lib/secure-store';
import { cancelAllTaskReminders } from '@/lib/notifications';

type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const [token, setToken] = useState<string | null>(null);
  const [cachedUser, setCachedUser] = useState<User | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    Promise.all([tokenStore.getToken(), cachedUserStore.get()]).then(([stored, storedUser]) => {
      setToken(stored);
      setCachedUser(storedUser);
      setTokenLoaded(true);
      if (!stored) setStatus('signedOut');
    });
  }, []);

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => fetchMe(token as string),
    enabled: tokenLoaded && !!token,
    retry: false,
  });

  useEffect(() => {
    if (!tokenLoaded || !token) return;

    // Already know we're offline — don't wait on the network round-trip to
    // fail before falling back to the cached profile. meQuery stays enabled
    // so it still reconciles in the background if connectivity returns.
    if (!isOnline && cachedUser) {
      setStatus('signedIn');
      return;
    }

    if (meQuery.isSuccess) {
      cachedUserStore.set(meQuery.data);
      setStatus('signedIn');
    } else if (meQuery.isError) {
      const err = meQuery.error;
      const isUnauthorized = err instanceof ApiError && err.status === 401;
      if (isUnauthorized) {
        tokenStore.removeToken();
        cachedUserStore.clear();
        setToken(null);
        setStatus('signedOut');
      } else if (cachedUser) {
        // Network error (or any other transient failure) with a cached
        // profile available — stay signed in rather than logging out.
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    }
  }, [tokenLoaded, token, isOnline, cachedUser, meQuery.isSuccess, meQuery.isError, meQuery.data, meQuery.error]);

  const logout = useCallback(async () => {
    await tokenStore.removeToken();
    await cachedUserStore.clear();
    await cancelAllTaskReminders();
    setToken(null);
    setCachedUser(null);
    queryClient.clear();
    setStatus('signedOut');
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const newToken = await apiLogin({ email, password });
      await tokenStore.setToken(newToken);
      const me = await fetchMe(newToken);
      await cachedUserStore.set(me);
      queryClient.setQueryData(queryKeys.me, me);
      setToken(newToken);
      setCachedUser(me);
      setStatus('signedIn');
    },
    [queryClient]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: meQuery.data ?? cachedUser ?? null,
      token,
      login,
      logout,
    }),
    [status, meQuery.data, cachedUser, token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
