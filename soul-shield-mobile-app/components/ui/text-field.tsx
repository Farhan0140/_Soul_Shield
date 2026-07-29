import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const dangerColor = useThemeColor({}, 'danger');
  const cardColor = useThemeColor({}, 'card');

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <TextInput
        placeholderTextColor={mutedColor}
        style={[
          styles.input,
          { color: textColor, borderColor: error ? dangerColor : borderColor, backgroundColor: cardColor },
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
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderCurve: 'continuous',
  },
  error: { fontSize: 13 },
});
