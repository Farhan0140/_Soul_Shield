import { ScrollView, StyleSheet } from 'react-native';

import { FilterChip } from '@/components/filters/filter-chip';
import type { IconSymbolName } from '@/components/ui/icon-symbol';

export type SourceFilter = 'all' | 'fixed' | 'mine';

const OPTIONS: { key: SourceFilter; label: string; icon: IconSymbolName }[] = [
  { key: 'all', label: 'All', icon: 'square.grid.2x2' },
  { key: 'fixed', label: 'Fixed', icon: 'shield.fill' },
  { key: 'mine', label: 'My Tasks', icon: 'person.fill' },
];

interface SourceFilterProps {
  value: SourceFilter;
  onChange: (value: SourceFilter) => void;
}

export function SourceFilterRow({ value, onChange }: SourceFilterProps) {
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
