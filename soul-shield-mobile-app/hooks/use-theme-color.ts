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
  const { resolvedTheme } = useAppTheme();
  const colorFromProps = props[ThemeScheme[resolvedTheme]];

  if (colorFromProps) {
    return colorFromProps;
  }
  return Colors[resolvedTheme][colorName];
}
