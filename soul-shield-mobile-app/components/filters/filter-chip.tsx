import { Pressable, StyleSheet, Text } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

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

  const activeColor = accentColor ?? tint;
  const foreground = active ? '#fff' : text;

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
      ]}>
      {icon ? (
        <IconSymbol name={icon} size={14} color={active ? '#fff' : muted} />
      ) : null}
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  label: { fontSize: 13, fontWeight: '600' },
});
