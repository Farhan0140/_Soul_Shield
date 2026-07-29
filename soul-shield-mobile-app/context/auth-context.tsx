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
import { queryKeys } from '@/lib/query-keys';
import { setUnauthorizedHandler } from '@/lib/query-client';
import { tokenStore } from '@/lib/secure-store';

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
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    tokenStore.getToken().then((stored) => {
      setToken(stored);
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
    if (meQuery.isSuccess) {
      setStatus('signedIn');
    } else if (meQuery.isError) {
      tokenStore.removeToken();
      setToken(null);
      setStatus('signedOut');
    }
  }, [tokenLoaded, token, meQuery.isSuccess, meQuery.isError]);

  const logout = useCallback(async () => {
    await tokenStore.removeToken();
    setToken(null);
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
      queryClient.setQueryData(queryKeys.me, me);
      setToken(newToken);
      setStatus('signedIn');
    },
    [queryClient]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: meQuery.data ?? null,
      token,
      login,
      logout,
    }),
    [status, meQuery.data, token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
