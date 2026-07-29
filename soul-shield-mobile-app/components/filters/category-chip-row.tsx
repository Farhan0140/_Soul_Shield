import { ScrollView, StyleSheet } from 'react-native';

import type { Category } from '@/api/types';
import { FilterChip } from '@/components/filters/filter-chip';

export const ALL_CATEGORIES = 'all';
export const UNCATEGORIZED = 'uncategorized';

interface CategoryChipRowProps {
  categories: Category[];
  selected: string;
  onSelect: (key: string) => void;
}

export function CategoryChipRow({ categories, selected, onSelect }: CategoryChipRowProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <FilterChip
        label="All"
        icon="square.grid.2x2"
        active={selected === ALL_CATEGORIES}
        onPress={() => onSelect(ALL_CATEGORIES)}
      />
      {categories.map((category) => (
        <FilterChip
          key={category.id}
          label={category.name}
          active={selected === String(category.id)}
          accentColor={category.color_hex}
          onPress={() => onSelect(String(category.id))}
        />
      ))}
      <FilterChip
        label="Uncategorized"
        icon="tag.fill"
        active={selected === UNCATEGORIZED}
        onPress={() => onSelect(UNCATEGORIZED)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
});
