import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useApi } from './ApiContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // { id, full_name, email, role }
  const [loading, setLoading] = useState(true); // initial token check
  const { getMe, loginUser, registerUser } = useApi();

  // On mount: if token exists, fetch /users/me to validate & populate user
  useEffect(() => {
    const token = localStorage.getItem('soulshield_token');
    if (!token) {
      // setLoading(false);
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('soulshield_token'))
      .finally(() => setLoading(false));
  }, [getMe]);

  const login = useCallback(async (email, password) => {
    const token = await loginUser(email, password);

    localStorage.setItem('soulshield_token', token);
    const me = await getMe();
    setUser(me);
    return me;
  }, [loginUser, getMe]);

  const register = useCallback(async (full_name, email, password) => {
    await registerUser(full_name, email, password);
  }, [registerUser]);

  const logout = useCallback(() => {
    localStorage.removeItem('soulshield_token');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await getMe();
    setUser(me);
  }, [getMe]);

  const value = useMemo(() => ({
    user, loading, login, register, logout, refreshUser, isAdmin: user?.role === 'admin',
  }), [user, loading, login, register, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
