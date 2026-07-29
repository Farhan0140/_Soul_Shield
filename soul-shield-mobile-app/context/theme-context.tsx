import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import type { ThemeName } from '@/constants/theme';
import { themePreferenceStore } from '@/lib/secure-store';

export type ThemePreference = 'system' | ThemeName;

const VALID_THEMES: ThemeName[] = ['light', 'dark', 'brown', 'lemonGreen'];

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ThemeName;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    themePreferenceStore.get().then((saved) => {
      if (saved === 'system' || VALID_THEMES.includes(saved as ThemeName)) {
        setPreferenceState(saved as ThemePreference);
      }
    });
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    themePreferenceStore.set(next);
  };

  const resolvedTheme: ThemeName = useMemo(() => {
    if (preference === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
    return preference;
  }, [preference, systemScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within an AppThemeProvider');
  return ctx;
}
