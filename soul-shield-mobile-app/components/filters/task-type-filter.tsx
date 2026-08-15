import { ScrollView, StyleSheet } from 'react-native';

import { FilterChip } from '@/components/filters/filter-chip';
import type { IconSymbolName } from '@/components/ui/icon-symbol';

export type TaskTypeFilter = 'all' | 'normal' | 'counter' | 'timer';

const OPTIONS: { key: TaskTypeFilter; label: string; icon: IconSymbolName }[] = [
  { key: 'all', label: 'All', icon: 'square.grid.2x2' },
  { key: 'normal', label: 'Normal', icon: 'checkmark.square' },
  { key: 'counter', label: 'Counter', icon: 'repeat' },
  { key: 'timer', label: 'Timer', icon: 'timer' },
];

interface TaskTypeFilterProps {
  value: TaskTypeFilter;
  onChange: (value: TaskTypeFilter) => void;
}

export function TaskTypeFilterRow({ value, onChange }: TaskTypeFilterProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {OPTIONS.map((option) => (
        <FilterChip
          key={option.key}
          label={option.label}
          icon={option.icon}
          active={value === option.key}
          onPress={() => onChange(option.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
});
