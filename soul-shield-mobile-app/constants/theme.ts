/**
 * Below are the color palettes used in the app. Each named theme defines the full
 * set of semantic colors consumed via useThemeColor/ThemedText/ThemedView.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    success: '#1E8E5A',
    danger: '#D0342C',
    warning: '#B8860B',
    muted: '#6B7280',
    border: '#E2E5E8',
    card: '#F7F8F9',
    missedTint: '#FBEAEA',
    completedTint: '#E9F7EF',
    partiallyCompletedTint: '#FDF3D9',
    categoryFallback: '#9CA3AF',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    success: '#4ADE80',
    danger: '#F87171',
    warning: '#FBBF24',
    muted: '#9CA3AF',
    border: '#2A2D2E',
    card: '#1D1F20',
    missedTint: '#2A1A1A',
    completedTint: '#16241C',
    partiallyCompletedTint: '#2A2410',
    categoryFallback: '#6B7280',
  },
  brown: {
    text: '#3E2723',
    background: '#F7EDE2',
    tint: '#8D5B3C',
    icon: '#8D6E52',
    tabIconDefault: '#A98F73',
    tabIconSelected: '#8D5B3C',
    success: '#557153',
    danger: '#B3452F',
    warning: '#C08A2E',
    muted: '#8A7566',
    border: '#E4D3BF',
    card: '#FBF4EC',
    missedTint: '#F4E1D8',
    completedTint: '#EAF0E2',
    partiallyCompletedTint: '#F5E6C8',
    categoryFallback: '#A98F73',
  },
  lemonGreen: {
    text: '#33430E',
    background: '#F9FBE7',
    tint: '#7CB342',
    icon: '#7C9A3A',
    tabIconDefault: '#A8C97F',
    tabIconSelected: '#7CB342',
    success: '#4E9A3A',
    danger: '#D0342C',
    warning: '#C9A227',
    muted: '#7C8A5E',
    border: '#E2ECC0',
    card: '#F3F8DE',
    missedTint: '#FBEAEA',
    completedTint: '#E7F3D6',
    partiallyCompletedTint: '#F7F0C9',
    categoryFallback: '#9CAF88',
  },
} as const;

export type ThemeName = keyof typeof Colors;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
