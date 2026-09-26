import { useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { useScrollToFocusedInput } from '@/components/ui/keyboard-avoiding-scroll-view';
import { useThemeColor } from '@/hooks/use-theme-color';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

/** Solid-bordered input, filled with the card color so it stands out against
 * the screen background, with a clear tint-colored focus ring — replaces the
 * previous dashed/"floating shadow" look (see git history), which read as
 * sketchy/unfinished rather than as a clearly editable field. */
export function TextField({ label, error, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const scrollToFocusedInput = useScrollToFocusedInput();
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const dangerColor = useThemeColor({}, 'danger');
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');

  const activeBorderColor = error ? dangerColor : focused ? tintColor : borderColor;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <TextInput
        placeholderTextColor={mutedColor}
        onFocus={(e) => {
          setFocused(true);
          scrollToFocusedInput?.(e);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: textColor,
            backgroundColor: cardColor,
            borderColor: activeBorderColor,
            borderWidth: focused || error ? 2 : 1.5,
          },
          style,
        ]}
        {...rest}
      />
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
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderCurve: 'continuous',
  },
  error: { fontSize: 13 },
});
