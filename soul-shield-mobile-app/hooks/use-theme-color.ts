/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light
) {
  const { resolvedTheme } = useAppTheme();
  const colorFromProps =
    resolvedTheme === 'light' || resolvedTheme === 'dark' ? props[resolvedTheme] : undefined;

  if (colorFromProps) {
    return colorFromProps;
  }
  return Colors[resolvedTheme][colorName];
}
