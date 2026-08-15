import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { TAP_SHADOW_OFFSET, tapShadowValue } from '@/components/ui/tap-shadow-button';
import { useThemeColor } from '@/hooks/use-theme-color';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  /** Opt-in "floating" dashed-border/hard-shadow look shared with
   * TapShadowButton (see components/ui/tap-shadow-button.tsx) — off by
   * default so the plain look elsewhere (auth screens, category form) is
   * unchanged; task-form.tsx turns it on for the fields the user picks out
   * as needing a clearer "this is editable" affordance (title, description,
   * reward text, target count, sub-task title/target count). Idle shows the
   * shadow (elevated); focusing the field animates it down flush against
   * its own shadow, the input equivalent of TapShadowButton's press. */
  shadowed?: boolean;
}

export function TextField({ label, error, style, shadowed, onFocus, onBlur, ...rest }: TextFieldProps) {
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const dangerColor = useThemeColor({}, 'danger');
  const cardColor = useThemeColor({}, 'card');

  // Computed here in plain JS (not inside the worklet below) since Reanimated
  // worklets can't call ordinary, non-worklet functions like tapShadowValue —
  // they can only capture the resulting string by closure.
  const shadowValue = tapShadowValue(error ? dangerColor : textColor);
  // 0 = idle/elevated (shadow visible, offset up-left), 1 = focused/flush (shadow hidden).
  const focused = useSharedValue(0);

  const shadowedFrameStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - focused.value) * -TAP_SHADOW_OFFSET },
      { translateY: (1 - focused.value) * -TAP_SHADOW_OFFSET },
    ],
    borderRadius: 14 - focused.value * 4,
    boxShadow: focused.value > 0.5 ? 'none' : shadowValue,
  }));

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <Animated.View
        style={[
          shadowed && {
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: error ? dangerColor : textColor,
            backgroundColor: cardColor,
          },
          shadowed && shadowedFrameStyle,
        ]}>
        <TextInput
          placeholderTextColor={mutedColor}
          onFocus={(e) => {
            if (shadowed) focused.value = withTiming(1, { duration: 110 });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            if (shadowed) focused.value = withTiming(0, { duration: 200 });
            onBlur?.(e);
          }}
          style={[
            styles.input,
            shadowed
              ? { color: textColor, borderWidth: 0, backgroundColor: 'transparent' }
              : { color: textColor, borderColor: error ? dangerColor : borderColor, backgroundColor: cardColor },
            style,
          ]}
          {...rest}
        />
      </Animated.View>
      {error ? (
        <Text selectable style={[styles.error, { color: dangerColor }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderCurve: 'continuous',
  },
  error: { fontSize: 13 },
});
