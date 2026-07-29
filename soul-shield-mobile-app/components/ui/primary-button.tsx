import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: PrimaryButtonProps) {
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');
  const card = useThemeColor({}, 'card');
  const text = useThemeColor({}, 'text');
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary' ? tint : variant === 'destructive' ? danger : card;
  const textColor = variant === 'secondary' ? text : '#fff';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  label: { fontSize: 16, fontWeight: '600' },
});
