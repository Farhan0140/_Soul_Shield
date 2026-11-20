import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { THEMES, DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME, migrateThemePreference } from './themes';

const THEME_KEY = 'soulshield_theme';
const ThemeContext = createContext(null);

function getSystemScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readSavedPreference() {
  try {
    return migrateThemePreference(localStorage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readSavedPreference);
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

  const scheme = THEMES.find((t) => t.key === resolvedTheme)?.scheme ?? 'light';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    root.setAttribute('data-scheme', scheme);
    // Keep the mobile browser chrome in step with the canvas color.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', scheme === 'dark' ? '#111318' : '#F5F2EC');
  }, [resolvedTheme, scheme]);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage blocked */ }
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, scheme, setPreference }),
    [preference, resolvedTheme, scheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the provider's hook lives beside it
export const useTheme = () => useContext(ThemeContext);
