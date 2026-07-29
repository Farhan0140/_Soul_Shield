import { StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { formatCompactNumber } from '@/lib/format';

interface CounterProgressBarProps {
  progress: number;
  target: number;
  color?: string;
}

export function CounterProgressBar({ progress, target, color }: CounterProgressBarProps) {
  const track = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'muted');
  const fillColor = color ?? tint;
  const ratio = target > 0 ? Math.min(progress / target, 1) : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View style={[styles.fill, { backgroundColor: fillColor, width: `${ratio * 100}%` }]} />
      </View>
      <Text style={[styles.label, { color: muted }]}>
        {formatCompactNumber(progress)}/{formatCompactNumber(target)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999 },
  label: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
