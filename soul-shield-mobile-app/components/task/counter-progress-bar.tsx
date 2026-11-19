import { StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemeDecor } from '@/components/ui/theme-decor';
import { useHandFont, useSurface } from '@/hooks/use-ui-style';
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
  const handFont = useHandFont();
  const surface = useSurface();
  // Pencil only (undefined elsewhere): outlined track, hatched fill.
  const trackSurface = surface('track');
  const fillColor = color ?? tint;
  const ratio = target > 0 ? Math.min(progress / target, 1) : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: track }, trackSurface]}>
        <ThemeDecor kind="track" />
        <View
          style={[
            styles.fill,
            { backgroundColor: fillColor, width: `${ratio * 100}%` },
            trackSurface && styles.hatchedFill,
          ]}>
          <ThemeDecor kind="track" hatch={fillColor} hatchSpacing={4} outline={false} />
        </View>
      </View>
      <Text style={[styles.label, { color: muted }, handFont.body]}>
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
  hatchedFill: { backgroundColor: 'transparent', borderRadius: 0 },
  label: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
