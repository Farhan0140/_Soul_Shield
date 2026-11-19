import { Pressable, StyleSheet, View } from 'react-native';

import type { Category } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeDecor } from '@/components/ui/theme-decor';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useSurface } from '@/hooks/use-ui-style';

interface CategoryRowProps {
  category: Category;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CategoryRow({ category, onPress, onEdit, onDelete }: CategoryRowProps) {
  const cardColor = useThemeColor({}, 'card');
  const mutedColor = useThemeColor({}, 'muted');
  const dangerColor = useThemeColor({}, 'danger');
  const surface = useSurface();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: cardColor, opacity: pressed ? 0.85 : 1 }, surface('card')]}>
      <ThemeDecor kind="card" />
      <View style={[styles.dot, { backgroundColor: category.color_hex }]} />
      <ThemedText type="defaultSemiBold" style={styles.name}>
        {category.name}
      </ThemedText>
      {/* TODO this button is for editing this category */}
      <Pressable accessibilityRole="button" accessibilityLabel="Edit category" onPress={onEdit} hitSlop={8} style={styles.actionButton}>
        <IconSymbol name="pencil" size={18} color={mutedColor} />
      </Pressable>
      {/* TODO this button is for deleting this category */}
      <Pressable accessibilityRole="button" accessibilityLabel="Delete category" onPress={onDelete} hitSlop={8} style={styles.actionButton}>
        <IconSymbol name="trash" size={18} color={dangerColor} />
      </Pressable>
    </Pressable>
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
