/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, ThemeScheme } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.softPaperLight
) {
  const { resolvedTheme, palette } = useAppTheme();
  const colorFromProps = props[ThemeScheme[resolvedTheme]];

  if (colorFromProps) {
    return colorFromProps;
  }
  // `palette` is Colors[resolvedTheme] as the active UI style renders it
  // (identical to it under the Normal style — see lib/ui-style/palette.ts).
  return palette[colorName];
}
