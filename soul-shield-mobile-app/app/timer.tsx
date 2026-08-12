import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { DurationPicker } from '@/components/timer/duration-picker';
import { TankFill } from '@/components/timer/tank-fill';
import { TimerControls } from '@/components/timer/timer-controls';
import { TimerRing } from '@/components/timer/timer-ring';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTimer } from '@/hooks/use-timer';

/** headerShown is set to false for this route (see app/_layout.tsx) so the
 * tank-fill animation can render truly edge-to-edge behind a custom top row,
 * rather than sitting under a native header bar. Layering (back to front):
 * themed background → TankFill (absolute, decorative) → title/close row →
 * ring + duration picker → bottom controls. */
export default function TimerScreen() {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const timer = useTimer();

  const isIdle = timer.status === 'idle';

  const handlePlayPause = () => {
    if (timer.status === 'running') timer.pause();
    else if (timer.status === 'paused') timer.resume();
    else timer.start();
  };

  return (
    <View style={[styles.screen, { backgroundColor: background }]}>
      <TankFill progress={timer.progress} />

      <View style={[styles.topRow, { paddingTop: insets.top + 12 }]}>
        <ThemedText style={[styles.title, { fontFamily: Fonts.mono, color: textColor }]}>Timer</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
          <IconSymbol name="xmark" size={22} color={textColor} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <TimerRing remainingMs={timer.remainingMs} />
        <DurationPicker selection={timer.selection} onChange={timer.setSelection} disabled={!isIdle} />
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <TimerControls
          status={timer.status}
          vibrationEnabled={timer.vibrationEnabled}
          onReset={timer.reset}
          onPlayPause={handlePlayPause}
          onToggleVibration={timer.toggleVibration}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { fontSize: 20 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 48 },
  controls: { paddingHorizontal: 8 },
});
