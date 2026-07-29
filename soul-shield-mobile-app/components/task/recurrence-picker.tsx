import { StyleSheet, View } from 'react-native';

import type { RecurrenceType } from '@/api/types';
import { FilterChip } from '@/components/filters/filter-chip';

const OPTIONS: { key: RecurrenceType; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'custom', label: 'Custom' },
];

interface RecurrencePickerProps {
  value: RecurrenceType;
  onChange: (value: RecurrenceType) => void;
}

export function RecurrencePicker({ value, onChange }: RecurrencePickerProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => (
        <FilterChip
          key={option.key}
          label={option.label}
          active={value === option.key}
          onPress={() => onChange(option.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8 } });
