import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { ThemeDecor } from '@/components/ui/theme-decor';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHandFont, useOnAccent, useSurface } from '@/hooks/use-ui-style';

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
  const surface = useSurface();
  const onAccent = useOnAccent();
  const handFont = useHandFont();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary' ? tint : variant === 'destructive' ? danger : card;
  const textColor = variant === 'secondary' ? text : onAccent;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1 },
        surface('button'),
      ]}>
      {/* Pencil: filled buttons get colored-pencil shading. */}
      <ThemeDecor kind="button" hatch={variant === 'secondary' ? undefined : backgroundColor} />
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }, handFont.body]}>{label}</Text>
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
