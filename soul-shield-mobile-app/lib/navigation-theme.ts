import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import { Colors, ThemeScheme, type ThemeName } from '@/constants/theme';

export function getNavigationTheme(themeName: ThemeName): Theme {
  const isDark = ThemeScheme[themeName] === 'dark';
  const base = isDark ? DarkTheme : DefaultTheme;
  const palette = Colors[themeName];

  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: palette.tint,
      background: palette.background,
      card: palette.card,
      text: palette.text,
      border: palette.border,
      notification: palette.danger,
    },
  };
}
