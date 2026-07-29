import { Pressable, StyleSheet, View } from 'react-native';

import type { Category } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface CategoryRowProps {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}

export function CategoryRow({ category, onEdit, onDelete }: CategoryRowProps) {
  const cardColor = useThemeColor({}, 'card');
  const mutedColor = useThemeColor({}, 'muted');
  const dangerColor = useThemeColor({}, 'danger');

  return (
    <View style={[styles.row, { backgroundColor: cardColor }]}>
      <View style={[styles.dot, { backgroundColor: category.color_hex }]} />
      <ThemedText type="defaultSemiBold" style={styles.name}>
        {category.name}
      </ThemedText>
      <Pressable onPress={onEdit} hitSlop={8} style={styles.actionButton}>
        <IconSymbol name="pencil" size={18} color={mutedColor} />
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8} style={styles.actionButton}>
        <IconSymbol name="trash" size={18} color={dangerColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  name: { flex: 1 },
  actionButton: { padding: 4 },
});
