import { ScrollView, StyleSheet } from 'react-native';

import type { Category } from '@/api/types';
import { FilterChip } from '@/components/filters/filter-chip';

interface CategoryPickerProps {
  categories: Category[];
  value: number | null;
  onChange: (value: number | null) => void;
}

export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <FilterChip label="None" active={value === null} onPress={() => onChange(null)} />
      {categories.map((category) => (
        <FilterChip
          key={category.id}
          label={category.name}
          active={value === category.id}
          accentColor={category.color_hex}
          onPress={() => onChange(category.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8 } });
