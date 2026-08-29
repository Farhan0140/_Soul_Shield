import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

const MENU_ITEMS: {
  key: string;
  title: string;
  description: string;
  icon: IconSymbolName;
  route: '/reorder/categories' | '/reorder/tasks' | '/reorder/subtasks';
}[] = [
  {
    key: 'categories',
    title: 'Categories',
    description: 'Change the order your categories appear in.',
    icon: 'tag.fill',
    route: '/reorder/categories',
  },
  {
    key: 'tasks',
    title: 'Tasks',
    description: "Pick a category, then reorder its tasks.",
    icon: 'checklist',
    route: '/reorder/tasks',
  },
  {
    key: 'subtasks',
    title: 'Sub-Tasks',
    description: "Pick a task, then reorder its sub-tasks.",
    icon: 'list.bullet',
    route: '/reorder/subtasks',
  },
];

export default function ReorderHubScreen() {
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <View style={styles.content}>
      <ThemedText style={[styles.intro, { color: mutedColor }]}>
        Pick what to reorder below. Use the up/down arrows to move an item, then tap Save.
      </ThemedText>
      {MENU_ITEMS.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => router.push(item.route)}
          style={({ pressed }) => [styles.row, { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.iconCircle, { backgroundColor: `${tintColor}1A` }]}>
            <IconSymbol name={item.icon} size={22} color={tintColor} />
          </View>
          <View style={styles.rowText}>
            <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
            <ThemedText style={[styles.rowDescription, { color: mutedColor }]}>
              {item.description}
            </ThemedText>
          </View>
          <IconSymbol name="chevron.right" size={18} color={mutedColor} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 20, gap: 14 },
  intro: { fontSize: 14, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowDescription: { fontSize: 13 },
});
