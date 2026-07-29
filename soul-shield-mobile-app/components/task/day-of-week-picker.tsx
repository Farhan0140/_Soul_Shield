import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { weekdayLabel } from '@/lib/date';

interface DayOfWeekPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
}

export function DayOfWeekPicker({ value, onChange }: DayOfWeekPickerProps) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');

  const toggle = (day: number) => {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day).sort((a, b) => a - b));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length: 7 }, (_, day) => day).map((day) => {
        const active = value.includes(day);
        return (
          <Pressable
            key={day}
            onPress={() => toggle(day)}
            style={[
              styles.day,
              { backgroundColor: active ? tint : card, borderColor: active ? tint : border },
            ]}>
            <Text style={[styles.label, { color: active ? '#fff' : text }]}>{weekdayLabel(day)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  label: { fontSize: 12, fontWeight: '600' },
});
