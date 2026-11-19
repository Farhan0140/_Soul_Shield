import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { Colors, DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, ThemeScheme, type ThemeName } from '@/constants/theme';
import { themePreferenceStore, uiStyleStore } from '@/lib/secure-store';
import {
  adaptPalette,
  buildStyleTokens,
  DEFAULT_UI_STYLE,
  isUIStyleName,
  type PaletteColors,
  type UIStyleName,
  type UIStyleTokens,
} from '@/lib/ui-style/palette';

export type ThemePreference = 'system' | ThemeName;

const VALID_THEMES = Object.keys(Colors) as ThemeName[];

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ThemeName;
  setPreference: (preference: ThemePreference) => void;
  /** Visual UI style (normal / paper / pencil) — independent of the color palette. */
  uiStyle: UIStyleName;
  setUIStyle: (style: UIStyleName) => void;
  /** The resolved palette's colors as the active UI style renders them
   * (identical to Colors[resolvedTheme] under 'normal'). */
  palette: PaletteColors;
  styleTokens: UIStyleTokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [uiStyle, setUIStyleState] = useState<UIStyleName>(DEFAULT_UI_STYLE);

  useEffect(() => {
    themePreferenceStore.get().then((saved) => {
      if (saved === 'system' || VALID_THEMES.includes(saved as ThemeName)) {
        setPreferenceState(saved as ThemePreference);
      }
    });
    uiStyleStore.get().then((saved) => {
      if (isUIStyleName(saved)) setUIStyleState(saved);
    });
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    themePreferenceStore.set(next);
  };

  const setUIStyle = (next: UIStyleName) => {
    setUIStyleState(next);
    uiStyleStore.set(next);
  };

  const resolvedTheme: ThemeName = useMemo(() => {
    if (preference === 'system') {
      return systemScheme === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
    }
    return preference;
  }, [preference, systemScheme]);

  const { palette, styleTokens } = useMemo(() => {
    const scheme = ThemeScheme[resolvedTheme];
    const adapted = adaptPalette(Colors[resolvedTheme], scheme, uiStyle);
    return { palette: adapted, styleTokens: buildStyleTokens(adapted, scheme, uiStyle) };
  }, [resolvedTheme, uiStyle]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, setPreference, uiStyle, setUIStyle, palette, styleTokens }),
    [preference, resolvedTheme, uiStyle, palette, styleTokens]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within an AppThemeProvider');
  return ctx;
}
