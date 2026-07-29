import { ScrollView, StyleSheet } from 'react-native';

import { FilterChip } from '@/components/filters/filter-chip';
import type { IconSymbolName } from '@/components/ui/icon-symbol';

export type StatusFilter = 'all' | 'pending' | 'completed' | 'missed';

const OPTIONS: { key: StatusFilter; label: string; icon: IconSymbolName }[] = [
  { key: 'all', label: 'All', icon: 'square.grid.2x2' },
  { key: 'pending', label: 'Pending', icon: 'clock' },
  { key: 'completed', label: 'Completed', icon: 'checkmark.circle.fill' },
  { key: 'missed', label: 'Missed', icon: 'xmark.circle.fill' },
];

interface StatusTabsProps {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}

export function StatusTabs({ value, onChange }: StatusTabsProps) {
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
