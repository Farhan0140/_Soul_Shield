import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface CounterTaskHeaderProps {
  title: string;
  description?: string | null;
}

export function CounterTaskHeader({ title, description }: CounterTaskHeaderProps) {
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title} numberOfLines={3}>
        {title}
      </ThemedText>
      {description ? (
        <ThemedText style={[styles.description, { color: mutedColor }]}>{description}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, alignItems: 'center', paddingHorizontal: 24 },
  title: { textAlign: 'center', fontSize: 24, lineHeight: 30 },
  description: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
