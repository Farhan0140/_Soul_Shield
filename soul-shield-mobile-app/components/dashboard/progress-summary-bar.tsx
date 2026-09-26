import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { useThemeColor } from '@/hooks/use-theme-color';

interface ProgressSummaryBarProps {
  completed: number;
  /** Tasks with some, but not all, of their sub-tasks done - drawn as their
   * own striped section, distinct from the solid section for fully
   * completed tasks (see StripedFill below). Optional/defaulted to 0 so
   * existing callers that only track completed/total keep compiling. */
  partiallyCompleted?: number;
  total: number;
}

const STRIPE_TILE = 8;

/** Diagonal stripe fill for the "partially completed" section - the same
 * warning tone StatusBadge already uses for a partially_completed task, with
 * a translucent white diagonal overlay so it reads as "in progress" rather
 * than a second solid color competing with the completed section. Built with
 * react-native-svg (already a dependency) rather than an image asset, so it
 * scales to any section width without tiling artifacts. */
function StripedFill({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <Pattern
          id="partial-stripes"
          patternUnits="userSpaceOnUse"
          width={STRIPE_TILE}
          height={STRIPE_TILE}
          patternTransform="rotate(45)">
          <Rect width={STRIPE_TILE} height={STRIPE_TILE} fill={color} />
          <Rect width={STRIPE_TILE / 2} height={STRIPE_TILE} fill="#FFFFFF" fillOpacity={0.35} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#partial-stripes)" />
    </Svg>
  );
}

export function ProgressSummaryBar({ completed, partiallyCompleted = 0, total }: ProgressSummaryBarProps) {
  const track = useThemeColor({}, 'border');
  const success = useThemeColor({}, 'success');
  const warning = useThemeColor({}, 'warning');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const completedRatio = total > 0 ? completed / total : 0;
  const partialRatio = total > 0 ? partiallyCompleted / total : 0;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: text }]}>
          {completed}/{total} Completed
        </Text>
        {partiallyCompleted > 0 ? (
          <Text style={[styles.partialLabel, { color: muted }]}>{partiallyCompleted} partial</Text>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View style={[styles.section, { left: 0, width: `${completedRatio * 100}%`, backgroundColor: success }]} />
        {partiallyCompleted > 0 ? (
          <View style={[styles.section, { left: `${completedRatio * 100}%`, width: `${partialRatio * 100}%` }]}>
            <StripedFill color={warning} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  label: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  partialLabel: { fontSize: 12, fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  section: { position: 'absolute', top: 0, bottom: 0 },
});
