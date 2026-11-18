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
import { onRefreshedToken } from '@/api/client'; import type { User } from '@/api/types';
import { ApiError } from '@/lib/errors'; import { ensureLocalOwnerRecorded, prepareLocalDataForUser, wipeAccountLocalData, } from '@/lib/local-owner';
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
  /** Replaces the stored session token (e.g. the one change-password returns,
   * since changing the password revokes every existing session). */
  replaceToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
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

    // Local-first startup: a cached profile is enough to enter the app
    // immediately — don't gate entry on the /me round-trip finishing.
    // `isOnline` only ever protected against the *offline* case; a
    // reachable-but-slow/cold backend (e.g. a Render free-tier cold start
    // taking a minute-plus to wake) is the same "don't make the user wait"
    // situation, so this no longer distinguishes the two. meQuery stays
    // enabled so it still reconciles the profile — or logs out on a real
    // 401 — once it eventually resolves in the background.
    if (cachedUser) {
      setStatus('signedIn');
      return;
    }

    if (meQuery.isSuccess) {
      cachedUserStore.set(meQuery.data);
      setStatus('signedIn');
    } else if (meQuery.isError) {
      // No cached profile to fall back to at this point (handled above).
      const err = meQuery.error;
      const isUnauthorized = err instanceof ApiError && err.status === 401;
      if (isUnauthorized) {
        tokenStore.removeToken();
        cachedUserStore.clear();
        setToken(null);
      }
      // Non-auth failure (offline, timeout, backend down): leave the token
      // in place so the next launch retries meQuery instead of forcing a
      // full re-login.
      setStatus('signedOut');
    }
  }, [tokenLoaded, token, cachedUser, meQuery.isSuccess, meQuery.isError, meQuery.data, meQuery.error]);

  // keepLocalData: an automatic sign-out because the token expired/was
  // rejected (401) must NOT wipe the on-device store - it may hold offline
  // edits that haven't been pushed yet, and signing back in as the same user
  // pushes them. Only an explicit logout clears it (see clearLocalDatabase).
  // Users who were already signed in before local-data ownership was tracked:
  // their local data is theirs, so record them as its owner (no-op once set).
  const signedInUserId =
    status === 'signedIn' ? (meQuery.data ?? cachedUser)?.id : undefined;
  useEffect(() => {
    if (signedInUserId != null)
      ensureLocalOwnerRecorded(signedInUserId).catch(() => {});
  }, [signedInUserId]);
  const logout = useCallback(
    async (options?: { keepLocalData?: boolean }) => {
      await tokenStore.removeToken();
      await cachedUserStore.clear();
      await cancelAllTaskReminders();
      if (options?.keepLocalData) {
        // Expired session: keep local data (and its recorded owner) so the
        // SAME user's offline edits survive re-login. A different account
        // signing in next gets it wiped by prepareLocalDataForUser.
        queryClient.clear();
      } else {
        // Explicit logout: remove everything that belongs to this account.
        await wipeAccountLocalData(queryClient);
      }
      setToken(null);
      setCachedUser(null);
      setStatus('signedOut');
    },
    [queryClient],
  );

  // api/client.ts already stored a renewed token; keep state in step so
  // screens pass the current one.
  useEffect(() => onRefreshedToken(setToken), []);

  const replaceToken = useCallback(async (next: string) => {
    await tokenStore.setToken(next);
    setToken(next);
  }, []
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout({ keepLocalData: true });
    });
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const newToken = await apiLogin({ email, password });
      const me = await fetchMe(newToken);
      // BEFORE the token is stored (nothing can sync with it yet): if the
      // local data belongs to a different account, wipe it so it can't be
      // shown to, or pushed into, this account.
      await prepareLocalDataForUser(me.id, queryClient);
      await tokenStore.setToken(newToken);
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
      replaceToken,
    }),
    [status, meQuery.data, cachedUser, token, login, logout, replaceToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
