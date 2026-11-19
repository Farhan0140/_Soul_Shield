import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeDecor } from '@/components/ui/theme-decor';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useOnAccent, useSurface } from '@/hooks/use-ui-style';
import type { TimerStatus } from '@/lib/timer/store';

interface TimerControlsProps {
  status: TimerStatus;
  vibrationEnabled: boolean;
  onReset: () => void;
  onPlayPause: () => void;
  onToggleVibration: () => void;
}

/** Bottom row: Reset (left), big circular Play/Pause (center, press-spring
 * animation mirrors components/ui/center-fab-button.tsx), vibrate-on/off
 * toggle (right) — matches the reference screenshot's control layout. */
export function TimerControls({
  status,
  vibrationEnabled,
  onReset,
  onPlayPause,
  onToggleVibration,
}: TimerControlsProps) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const surface = useSurface();
  const onAccent = useOnAccent();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isRunning = status === 'running';

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onReset}
        hitSlop={12}
        style={[styles.sideButton, { backgroundColor: card }, surface('fab')]}
        accessibilityRole="button"
        accessibilityLabel="Reset timer">
        <ThemeDecor kind="circle" />
        <IconSymbol name="arrow.counterclockwise" size={22} color={text} />
      </Pressable>

      <Pressable
        onPress={onPlayPause}
        onPressIn={() => {
          scale.value = withSpring(0.92, { damping: 14, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 10, stiffness: 200 });
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={isRunning ? 'Pause timer' : 'Start timer'}>
        <Animated.View style={[styles.playButton, { backgroundColor: tint }, surface('fab'), animatedStyle]}>
          <ThemeDecor kind="fab" hatch={tint} />
          <IconSymbol name={isRunning ? 'pause.fill' : 'play.fill'} size={30} color={onAccent} />
        </Animated.View>
      </Pressable>

      <Pressable
        onPress={onToggleVibration}
        hitSlop={12}
        style={[styles.sideButton, { backgroundColor: card }, surface('fab')]}
        accessibilityRole="button"
        accessibilityLabel={vibrationEnabled ? 'Vibration on' : 'Vibration off'}>
        <ThemeDecor kind="circle" />
        <IconSymbol
          name="iphone.radiowaves.left.and.right"
          size={22}
          color={vibrationEnabled ? tint : muted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  sideButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
    }),
  },
});
