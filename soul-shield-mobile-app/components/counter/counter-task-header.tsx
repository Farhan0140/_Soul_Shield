import { StyleSheet, View } from 'react-native';

import { ExpandableText } from '@/components/ui/expandable-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface CounterTaskHeaderProps {
  title: string;
  description?: string | null;
  /** Set only for a counter/timer sub-task's page — the owning main task's
   * title, shown above the sub-task's own title so it's clear which task
   * this belongs to. */
  parentTitle?: string | null;
}

/** Details-page header hierarchy (Main Task and Sub-Task pages alike):
 * the parent task's title on top, then the current task's title in the SAME
 * size/weight as the parent's, then the current task's description in a
 * smaller font directly below its title. Parent title, current title, and
 * description each collapse to a few lines when long and expand on tap (see
 * ExpandableText) — short ones render fully with no expand control. */
export function CounterTaskHeader({ title, description, parentTitle }: CounterTaskHeaderProps) {
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <View style={styles.container}>
      {parentTitle ? <ExpandableText text={parentTitle} maxLines={2} style={styles.taskTitle} /> : null}
      {/* Same font size and visual weight as the parent title above (see the
          doc comment — the hierarchy comes from ordering, not from a smaller
          heading for the sub-task). */}
      <ExpandableText text={title} maxLines={2} style={styles.taskTitle} />
      {description ? (
        <ExpandableText
          text={description}
          maxLines={3}
          style={[styles.description, { color: mutedColor }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, alignItems: 'center', paddingHorizontal: 24 },
  taskTitle: { textAlign: 'center', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  description: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
