import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { TaskCard } from '@/components/task/task-card';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface CategorySectionProps {
  title: string;
  count: number;
  accentColor: string;
  icon?: IconSymbolName;
  expanded: boolean;
  onToggle: () => void;
  tasks: Task[];
  date: string;
  isAdmin: boolean;
  /** See TaskCard — surfaces original-category context when tasks are shown
   * outside their normal category grouping (the Completed Tasks section). */
  showCategoryBadge?: boolean;
  emptyLabel?: string;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onRewardEarned?: (task: Task, text: string) => void;
}

export function CategorySection({
  title,
  count,
  accentColor,
  icon,
  expanded,
  onToggle,
  tasks,
  date,
  isAdmin,
  showCategoryBadge,
  emptyLabel = 'No active tasks in this category.',
  onToggleComplete,
  onEdit,
  onDelete,
  onRewardEarned,
}: CategorySectionProps) {
  const mutedColor = useThemeColor({}, 'muted');
  const cardColor = useThemeColor({}, 'card');

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[styles.container, { backgroundColor: cardColor }]}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.header,
          { backgroundColor: `${accentColor}1A`, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}>
        {icon ? (
          <IconSymbol name={icon} size={18} color={accentColor} />
        ) : (
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
        )}
        <ThemedText type="defaultSemiBold" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.count, { color: mutedColor }]}>({count})</ThemedText>
        <IconSymbol
          name="chevron.right"
          size={16}
          color={mutedColor}
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          layout={LinearTransition.duration(220)}
          style={styles.body}>
          {tasks.length === 0 ? (
            <ThemedText style={[styles.empty, { color: mutedColor }]}>{emptyLabel}</ThemedText>
          ) : (
            tasks.map((task) => (
              <Animated.View
                key={task.task_id}
                layout={LinearTransition.duration(220)}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(160)}>
                <TaskCard
                  task={task}
                  date={date}
                  isAdmin={isAdmin}
                  showCategoryBadge={showCategoryBadge}
                  onToggleComplete={() => onToggleComplete(task)}
                  onEdit={() => onEdit(task)}
                  onDelete={() => onDelete(task)}
                  onRewardEarned={(text) => onRewardEarned?.(task, text)}
                />
              </Animated.View>
            ))
          )}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { flex: 1 },
  count: { fontSize: 14 },
  body: { padding: 12, gap: 12 },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});
