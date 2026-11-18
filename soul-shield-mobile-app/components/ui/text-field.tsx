import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useScrollToFocusedInput } from '@/components/ui/keyboard-avoiding-scroll-view';
import { useThemeColor } from '@/hooks/use-theme-color';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Muted helper text under the field (e.g. password rules); hidden while
   * an error is shown in its place. */
  hint?: string;
}

/** Solid-bordered input, filled with the card color so it stands out against
 * the screen background, with a clear tint-colored focus ring — replaces the
 * previous dashed/"floating shadow" look (see git history), which read as
 * sketchy/unfinished rather than as a clearly editable field. */
export function TextField({
  label,
  error,
  hint,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  // U6: password fields get a show/hide toggle, so a typo can be checked.
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;
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
      {label ? <Text style={[styles.label, { color: mutedColor }]}>{label}</Text> : null}
      <View>
        <TextInput
          placeholderTextColor={mutedColor}
          accessibilityLabel={label}
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
            isPassword && styles.inputWithToggle,
            style,
          ]}
          {...rest}
          secureTextEntry={isPassword && !revealed}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            style={styles.toggle}>
            <IconSymbol name={revealed ? 'eye.slash' : 'eye'} size={20} color={mutedColor} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text selectable style={[styles.error, { color: dangerColor }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: mutedColor }]}>{hint}</Text>
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
  inputWithToggle: { paddingRight: 46 },
  toggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  error: { fontSize: 13 },
  hint: { fontSize: 12 },
});
