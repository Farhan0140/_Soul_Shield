import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TaskTimerStatus } from '@/lib/timer-task/store';

interface TimerTaskControlsProps {
  status: TaskTimerStatus;
  disabled?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
}

/** Single centered Play/Pause button — same press-spring styling as
 * components/timer/timer-controls.tsx's primary button, minus the reset and
 * vibration-toggle side buttons (Timer Tasks only expose Start/Pause/Resume,
 * per spec). The press handler branches on `status` so this is one button
 * whose action changes rather than three separate controls. */
export function TimerTaskControls({ status, disabled, onStart, onPause, onResume }: TimerTaskControlsProps) {
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'muted');
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isRunning = status === 'running';
  const isCompleted = status === 'completed';

  const handlePress = () => {
    if (disabled || isCompleted) return;
    if (status === 'idle') onStart();
    else if (status === 'running') onPause();
    else if (status === 'paused') onResume();
  };

  const label = isCompleted ? 'Completed' : status === 'idle' ? 'Start timer' : isRunning ? 'Pause timer' : 'Resume timer';
  const iconName = isCompleted ? 'checkmark' : isRunning ? 'pause.fill' : 'play.fill';

  return (
    <View style={styles.row}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          if (disabled || isCompleted) return;
          scale.value = withSpring(0.92, { damping: 14, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 10, stiffness: 200 });
        }}
        hitSlop={12}
        disabled={disabled || isCompleted}
        accessibilityRole="button"
        accessibilityLabel={label}>
        <Animated.View
          style={[
            styles.playButton,
            { backgroundColor: disabled || isCompleted ? muted : tint, opacity: disabled ? 0.6 : 1 },
            animatedStyle,
          ]}>
          <IconSymbol name={iconName} size={30} color="#fff" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'center' },
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
