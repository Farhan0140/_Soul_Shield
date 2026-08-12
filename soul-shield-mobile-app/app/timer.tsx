import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { DurationPicker } from '@/components/timer/duration-picker';
import { TankFill } from '@/components/timer/tank-fill';
import { TimerControls } from '@/components/timer/timer-controls';
import { TimerRing } from '@/components/timer/timer-ring';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, ThemeScheme } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTimer } from '@/hooks/use-timer';

/** headerShown is set to false for this route (see app/_layout.tsx) so the
 * tank-fill animation can render truly edge-to-edge behind a custom top row,
 * rather than sitting under a native header bar. Layering (back to front):
 * themed background → TankFill (absolute, decorative) → title/close row →
 * ring + duration picker → bottom controls. */
export default function TimerScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const { resolvedTheme } = useAppTheme();
  const timer = useTimer();

  const isIdle = timer.status === 'idle';

  // Once the rising tank-fill water reaches the duration picker's on-screen
  // position, its selected digits switch to a flat black/white contrast
  // color (picked from the light/dark-ness of the current theme) instead of
  // the normal theme text color, so they stay readable against the tinted
  // water rather than blending into it.
  const pickerRef = useRef<View>(null);
  const [pickerTopY, setPickerTopY] = useState<number | null>(null);
  const handlePickerLayout = useCallback(() => {
    pickerRef.current?.measureInWindow((_x, y) => setPickerTopY(y));
  }, []);
  const waterTopY = windowHeight * (1 - timer.progress);
  const isSubmerged = pickerTopY != null && waterTopY <= pickerTopY;
  const contrastColor = ThemeScheme[resolvedTheme] === 'dark' ? '#FFFFFF' : '#000000';

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
        <View ref={pickerRef} onLayout={handlePickerLayout}>
          <DurationPicker
            selection={timer.selection}
            onChange={timer.setSelection}
            disabled={!isIdle}
            selectedColor={isSubmerged ? contrastColor : undefined}
          />
        </View>
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
