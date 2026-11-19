import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import { Colors, ThemeScheme, type ThemeName } from '@/constants/theme';
import type { PaletteColors } from '@/lib/ui-style/palette';

/** `palette` defaults to the raw palette; pass the UI-style-adapted one
 * (theme context's `palette`) so navigation chrome matches Paper/Pencil.
 * `handFontFamily` (Paper/Pencil only) swaps the header/label fonts for the
 * single-weight handwritten family, with every weight reset to 'normal'. */
export function getNavigationTheme(
  themeName: ThemeName,
  palette: PaletteColors = Colors[themeName],
  handFontFamily?: string
): Theme {
  const isDark = ThemeScheme[themeName] === 'dark';
  const base = isDark ? DarkTheme : DefaultTheme;
  const hand = handFontFamily ? { fontFamily: handFontFamily, fontWeight: 'normal' as const } : null;

  return {
    ...base,
    fonts: hand ? { regular: hand, medium: hand, bold: hand, heavy: hand } : base.fonts,
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
