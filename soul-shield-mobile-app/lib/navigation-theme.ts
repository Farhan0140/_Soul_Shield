import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import { Colors, type ThemeName } from '@/constants/theme';

export function getNavigationTheme(themeName: ThemeName): Theme {
  const base = themeName === 'dark' ? DarkTheme : DefaultTheme;
  const palette = Colors[themeName];

  return {
    ...base,
    dark: themeName === 'dark',
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
