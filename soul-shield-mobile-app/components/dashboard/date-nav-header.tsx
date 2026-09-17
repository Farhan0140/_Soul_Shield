import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBackgroundSyncPhase } from '@/hooks/use-background-sync-status';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayDate, isToday } from '@/lib/date';

interface DateNavHeaderProps {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function DateNavHeader({ date, onPrev, onNext, onToday }: DateNavHeaderProps) {
  const tint = useThemeColor({}, 'tint');
  const showToday = !isToday(date);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <ThemedText type="title">Today&apos;s Tasks</ThemedText>
        <SyncLabel />
      </View>
      <SyncProgressBar />
      <View style={styles.row}>
        <Pressable onPress={onPrev} hitSlop={8} style={styles.arrow}>
          <IconSymbol name="chevron.left" size={20} color={tint} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.date}>
          {formatDisplayDate(date)}
        </ThemedText>
        <Pressable onPress={onNext} hitSlop={8} style={styles.arrow}>
          <IconSymbol name="chevron.right" size={20} color={tint} />
        </Pressable>
        {showToday ? (
          <Pressable onPress={onToday} hitSlop={8}>
            <ThemedText type="link" style={styles.today}>
              Today
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const SYNC_BAR_HEIGHT = 2;
/** Fraction of the track width the moving segment covers — a classic
 * indeterminate-progress look (a short segment sweeping the full track), not
 * a determinate fill, since sync.ts has no per-day progress to report, only
 * "in flight" or not. */
const SYNC_BAR_SEGMENT_RATIO = 0.4;
const SYNC_BAR_SWEEP_MS = 900;

/** "Syncing…"/"Synced"/"Sync failed", top-right of the "Today's Tasks" title
 * row — the explicit answer to "is it syncing right now". 'idle' renders
 * nothing (no layout reserved), so a session that hasn't synced yet looks
 * exactly like before this existed. */
function SyncLabel() {
  const mutedColor = useThemeColor({}, 'muted');
  const errorColor = useThemeColor({}, 'danger');
  const phase = useBackgroundSyncPhase();

  if (phase === 'idle') return null;

  return (
    <ThemedText style={[styles.syncLabel, { color: phase === 'failed' ? errorColor : mutedColor }]}>
      {phase === 'syncing' ? 'Syncing…' : phase === 'synced' ? 'Synced' : 'Sync failed'}
    </ThemedText>
  );
}

/** Thin (2px) bar under the "Today's Tasks" title that appears only while a
 * sync is actually in flight — the same at-a-glance motion cue this had
 * before SyncLabel existed, kept in its original position (unlike the label,
 * which now sits top-right on the title row instead of stacked underneath). */
function SyncProgressBar() {
  const tint = useThemeColor({}, 'tint');
  const phase = useBackgroundSyncPhase();
  const [trackWidth, setTrackWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const isSyncing = phase === 'syncing';

  useEffect(() => {
    if (!isSyncing || trackWidth === 0) return;

    sweep.setValue(0);
    const animation = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: SYNC_BAR_SWEEP_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [isSyncing, trackWidth, sweep]);

  if (!isSyncing) return null;

  const handleLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);
  const segmentWidth = trackWidth * SYNC_BAR_SEGMENT_RATIO;
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-segmentWidth, trackWidth],
  });

  return (
    <View style={styles.syncTrack} onLayout={handleLayout} pointerEvents="none">
      {trackWidth > 0 ? (
        <Animated.View
          style={[
            styles.syncSegment,
            { width: segmentWidth, backgroundColor: tint, transform: [{ translateX }] },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { padding: 4 },
  date: { flex: 1 },
  today: { fontSize: 14 },
  syncLabel: { fontSize: 12 },
  syncTrack: {
    height: SYNC_BAR_HEIGHT,
    borderRadius: SYNC_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  syncSegment: {
    height: SYNC_BAR_HEIGHT,
    borderRadius: SYNC_BAR_HEIGHT / 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
