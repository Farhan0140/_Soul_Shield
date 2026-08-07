import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { THEME_KEYS, DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from './themes';

const THEME_KEY = 'soulshield_theme';
const ThemeContext = createContext(null);

function getSystemScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'system' || THEME_KEYS.includes(saved)) return saved;
    return 'system';
  });
  const [systemScheme, setSystemScheme] = useState(getSystemScheme);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemScheme(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = useMemo(() => {
    if (preference === 'system') {
      return systemScheme === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
    }
    return preference;
  }, [preference, systemScheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    localStorage.setItem(THEME_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
