import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

export function RewardBanner({ text }: { text: string }) {
  const success = useThemeColor({}, 'success');

  return (
    <View style={styles.row}>
      <IconSymbol name="sparkles" size={16} color={success} />
      <ThemedText selectable style={[styles.text, { color: success }]}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
