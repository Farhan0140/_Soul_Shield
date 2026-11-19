import { StyleSheet, Text, type TextProps } from 'react-native';

import { HAND_FONTS } from '@/constants/ui-style';
import { useArabicFont } from '@/context/arabic-font-context';
import { useAppTheme } from '@/context/theme-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { containsArabic } from '@/lib/arabic';

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
  const { fontFamily: arabicFontFamily } = useArabicFont();
  const { styleTokens } = useAppTheme();
  // Auto-detects Arabic script (e.g. a task title/description written in
  // Arabic) and switches to the user's chosen Arabic font for it (see
  // context/arabic-font-context.tsx) — unless the caller already asked for a
  // specific fontFamily of its own (e.g. the Fonts.mono digits in the timer
  // screens), which still wins.
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
  const arabicFontStyle = arabicApplies ? { fontFamily: arabicFontFamily } : undefined;

  // Paper/Pencil UI styles: handwritten Latin text (constants/ui-style.ts) —
  // Patrick Hand for body text, Caveat for title/subtitle. Same precedence
  // rules as the Arabic font above: the user's Arabic-font choice still
  // wins for Arabic text, and a caller's explicit fontFamily (e.g. the mono
  // timer digits) still wins over both. Bengali-script strings keep the
  // system font, since neither handwritten family has Bengali glyphs. Like
  // the Arabic font, these families ship a single weight per name, so
  // fontWeight is reset (Android would otherwise drop the custom font).
  const isBengali = typeof children === 'string' && BENGALI_SCRIPT_PATTERN.test(children);
  const handApplies = styleTokens.handDrawn && !isArabic && !isBengali && !callerStyle?.fontFamily;
  const isHeading = type === 'title' || type === 'subtitle';
  // Caveat's x-height runs ~25% smaller than system text at the same size.
  const headingSize = baseFontSize * 1.25;
  const handOverride = handApplies
    ? isHeading
      ? { fontFamily: HAND_FONTS.heading, fontWeight: 'normal' as const, fontSize: headingSize, lineHeight: headingSize * 1.15 }
      : { fontFamily: HAND_FONTS.body, fontWeight: 'normal' as const }
    : undefined;

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
        handOverride,
      ]}
      {...rest}>
      {children}
    </Text>
  );
}

/** Bengali block (U+0980–U+09FF). */
const BENGALI_SCRIPT_PATTERN = /[ঀ-৿]/;

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
