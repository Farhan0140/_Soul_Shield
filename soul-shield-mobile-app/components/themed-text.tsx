import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { ARABIC_FONT_FAMILY, containsArabic } from '@/lib/arabic';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  children,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  // Auto-detects Arabic script (e.g. a task title/description written in
  // Arabic) and switches to the Indopak Nastaleeq font for it — unless the
  // caller already asked for a specific fontFamily of its own (e.g. the
  // Fonts.mono digits in the timer screens), which still wins.
  const isArabic = typeof children === 'string' && containsArabic(children);
  const callerStyle = StyleSheet.flatten(style);
  const arabicApplies = isArabic && !callerStyle?.fontFamily;

  const typeStyle = StyleSheet.flatten(
    type === 'title'
      ? styles.title
      : type === 'subtitle'
        ? styles.subtitle
        : type === 'link'
          ? styles.link
          : type === 'defaultSemiBold'
            ? styles.defaultSemiBold
            : styles.default
  );
  const baseFontSize = callerStyle?.fontSize ?? typeStyle?.fontSize ?? 16;
  // Nastaleeq-script glyphs read visually smaller than Latin/Naskh text at
  // the same point size and have tall loops/diacritics that a fixed,
  // Latin-tuned lineHeight clips off — so Arabic text is scaled up and given
  // a generous, proportional lineHeight instead of whatever fixed size the
  // type/caller styles set. The font also ships only a single Regular
  // weight: on Android, a custom font combined with a fontWeight it has no
  // matching face for gets silently dropped in favor of the system font, so
  // fontWeight is reset here too. All placed after `style` below so they
  // override it, unlike the fontFamily override above.
  const arabicOverride = arabicApplies
    ? { fontWeight: 'normal' as const, fontSize: baseFontSize * 1.15, lineHeight: baseFontSize * 1.15 * 1.8 }
    : undefined;
  const arabicFontStyle = arabicApplies ? { fontFamily: ARABIC_FONT_FAMILY } : undefined;

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        arabicFontStyle,
        style,
        arabicOverride,
      ]}
      {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
