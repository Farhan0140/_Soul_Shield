import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // { id, full_name, email, role }
  const [loading, setLoading] = useState(true); // initial token check

  // On mount: if token exists, fetch /users/me to validate & populate user
  useEffect(() => {
    const token = localStorage.getItem('soulshield_token');
    if (!token) {
      // setLoading(false);
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    api.get('/users/me')
      .then(setUser)
      .catch(() => localStorage.removeItem('soulshield_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { token } = await api.post('/users/login', { email, password }, { auth: false });
    localStorage.setItem('soulshield_token', token);
    const me = await api.get('/users/me');
    setUser(me);
    return me;
  };

  const register = async (name, email, password) => {
    await api.post('/users/register', { name, email, password }, { auth: false });
  };

  const logout = () => {
    localStorage.removeItem('soulshield_token');
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await api.get('/users/me');
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);