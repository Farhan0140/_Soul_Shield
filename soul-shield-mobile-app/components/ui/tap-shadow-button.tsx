import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useThemeColor } from '@/hooks/use-theme-color';
import { hexToRgba } from '@/lib/color';

/** Shared with text-field.tsx's `shadowed` variant so every "floating,
 * dashed-border, shadowed" control in the app moves by the same amount. */
export const TAP_SHADOW_OFFSET = 4;
const TAP_SHADOW_BLUR = 10;
const TAP_SHADOW_ALPHA = 0.3;

/** The soft, translucent offset shadow shared by TapShadowButton and
 * text-field.tsx's `shadowed` variant — blurred and low-opacity rather than
 * a solid unblurred block, which read as a heavy-handed flat color patch
 * rather than a shadow. `hexColor` must be a theme token (plain `#RRGGBB`,
 * see lib/color.ts), never a hardcoded literal, so this follows light/dark
 * theme changes automatically. */
export function tapShadowValue(hexColor: string): string {
  return `${TAP_SHADOW_OFFSET}px ${TAP_SHADOW_OFFSET}px ${TAP_SHADOW_BLUR}px ${hexToRgba(hexColor, TAP_SHADOW_ALPHA)}`;
}

interface TapShadowButtonProps {
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** A "floating" button with a dashed border and a soft offset shadow — reads
 * as a distinctly tappable control rather than a plain input field. Web-hover
 * buttons in this style reveal the shadow/lift on
 * `:hover` and flatten on `:active`; there's no hover on a touch device, so
 * here the idle state IS the lifted/hover look (shadow visible, offset
 * up-left) and pressing it animates the button down onto its own shadow
 * (which disappears once "flush"), springing back on release — the same
 * visual states, just driven by touch instead of a mouse. */
export function TapShadowButton({ onPress, disabled, children, style, accessibilityLabel }: TapShadowButtonProps) {
  const textColor = useThemeColor({}, 'text');
  const cardColor = useThemeColor({}, 'card');
  // Computed here in plain JS (not inside the worklet below) since Reanimated
  // worklets can't call ordinary, non-worklet functions like tapShadowValue —
  // they can only capture the resulting string by closure.
  const shadowValue = tapShadowValue(textColor);
  // 0 = idle/elevated (shadow visible, offset up-left), 1 = pressed/flush (shadow hidden).
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - pressed.value) * -TAP_SHADOW_OFFSET },
      { translateY: (1 - pressed.value) * -TAP_SHADOW_OFFSET },
    ],
    borderRadius: 16 - pressed.value * 6,
    boxShadow: pressed.value > 0.5 ? 'none' : shadowValue,
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 110 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 200 });
      }}>
      <Animated.View
        style={[
          styles.base,
          { borderColor: textColor, backgroundColor: cardColor, opacity: disabled ? 0.5 : 1 },
          animatedStyle,
          style,
        ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
