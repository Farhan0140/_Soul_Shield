import { StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

interface ProgressSummaryBarProps {
  completed: number;
  total: number;
}

export function ProgressSummaryBar({ completed, total }: ProgressSummaryBarProps) {
  const track = useThemeColor({}, 'border');
  const success = useThemeColor({}, 'success');
  const text = useThemeColor({}, 'text');
  const ratio = total > 0 ? completed / total : 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: text }]}>
        {completed}/{total} Completed
      </Text>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View style={[styles.fill, { backgroundColor: success, width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
