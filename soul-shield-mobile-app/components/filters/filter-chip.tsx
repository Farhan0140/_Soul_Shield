import { Pressable, StyleSheet, Text } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { ThemeDecor } from '@/components/ui/theme-decor';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHandFont, useOnAccent, useSurface } from '@/hooks/use-ui-style';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  accentColor?: string;
  icon?: IconSymbolName;
}

export function FilterChip({ label, active, onPress, accentColor, icon }: FilterChipProps) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');

  const surface = useSurface();
  const onAccent = useOnAccent();
  const handFont = useHandFont();
  const activeColor = accentColor ?? tint;
  const foreground = active ? onAccent : text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? activeColor : card,
          borderColor: active ? activeColor : border,
          opacity: pressed ? 0.8 : 1,
        },
        surface('chip'),
      ]}>
      <ThemeDecor kind="chip" hatch={active ? activeColor : undefined} />
      {icon ? (
        <IconSymbol name={icon} size={14} color={active ? onAccent : muted} />
      ) : null}
      <Text style={[styles.label, { color: foreground }, handFont.body]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  label: { fontSize: 13, fontWeight: '600' },
});
