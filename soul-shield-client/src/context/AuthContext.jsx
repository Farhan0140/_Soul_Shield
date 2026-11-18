import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useApi } from './ApiContext';
import { SESSION_EXPIRED_EVENT, clearToken, getToken, setToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // { id, full_name, email, role }
  const [loading, setLoading] = useState(true); // initial token check
  // True after an authenticated request was refused (token expired/revoked):
  // the login page explains why the user landed there.
  const [sessionExpired, setSessionExpired] = useState(false);
  const { getMe, loginUser } = useApi();

  // On mount: if token exists, fetch /users/me to validate & populate user
  useEffect(() => {
    if (!getToken()) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    getMe()
      .then(setUser)
      // A 401 already cleared the token (api.js). Any other failure (offline,
      // server waking up) keeps it, so a flaky network doesn't sign anyone out.
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [getMe]);

  // Any authenticated request answered 401 -> sign out locally. ProtectedRoute
  // then redirects to /login.
  useEffect(() => {
    const onExpired = () => {
      setUser((current) => {
        if (current) setSessionExpired(true);
        return null;
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const token = await loginUser(email, password);

    setToken(token);
    const me = await getMe();
    setSessionExpired(false);
    setUser(me);
    return me;
  }, [loginUser, getMe]);

  const logout = useCallback(() => {
    clearToken();
    setSessionExpired(false);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await getMe();
    setUser(me);
  }, [getMe]);

  const value = useMemo(() => ({
    user, loading, sessionExpired, login, logout, refreshUser, isAdmin: user?.role === 'admin',
  }), [user, loading, sessionExpired, login, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- the provider's hook lives beside it
export const useAuth = () => useContext(AuthContext);
