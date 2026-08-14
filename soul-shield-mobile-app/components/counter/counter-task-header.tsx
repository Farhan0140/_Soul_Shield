import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface CounterTaskHeaderProps {
  title: string;
  description?: string | null;
  /** Set only for a counter sub-task's page — the owning main task's title,
   * shown above the sub-task's own title so it's clear which task this
   * counter belongs to. */
  parentTitle?: string | null;
}

export function CounterTaskHeader({ title, description, parentTitle }: CounterTaskHeaderProps) {
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <View style={styles.container}>
      {parentTitle ? <ThemedText style={styles.parentTitle}>{parentTitle}</ThemedText> : null}
      {/* h3-sized when this is the only title (a main counter task); shrinks
          to h4 once parentTitle is shown above it (a counter sub-task), so
          the main task stays the visually dominant heading. No numberOfLines
          on either — the full title should always be readable here, never
          truncated with an ellipsis. */}
      <ThemedText style={[parentTitle ? styles.subTitle : styles.title]}>{title}</ThemedText>
      {description ? (
        <ThemedText style={[styles.description, { color: mutedColor }]}>{description}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, alignItems: 'center', paddingHorizontal: 24 },
  parentTitle: { textAlign: 'center', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  title: { textAlign: 'center', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  subTitle: { textAlign: 'center', fontSize: 18, fontWeight: '600', lineHeight: 24 },
  description: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
