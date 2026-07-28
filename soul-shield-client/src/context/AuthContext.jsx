import { createContext, useContext, useEffect, useState } from 'react';
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

  const login = async (email, password) => {
    const token = await loginUser(email, password);

    localStorage.setItem('soulshield_token', token);
    const me = await getMe();
    setUser(me);
    return me;
  };

  const register = async (full_name, email, password) => {
    await registerUser(full_name, email, password);
  };

  const logout = () => {
    localStorage.removeItem('soulshield_token');
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await getMe();
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);