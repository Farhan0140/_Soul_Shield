import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TaskTimerStatus } from '@/lib/timer-task/store';

interface TimerTaskControlsProps {
  status: TaskTimerStatus;
  disabled?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  /** Manual completion path — converges on the same completion pipeline as
   * the timer reaching zero (see hooks/use-task-timer.ts's `complete`), so
   * the user can finish the task immediately without waiting out the
   * remaining duration. */
  onComplete: () => void;
}

/** Centered Play/Pause button — same press-spring styling as
 * components/timer/timer-controls.tsx's primary button, minus the reset and
 * vibration-toggle side buttons (Timer Tasks only expose Start/Pause/Resume,
 * per spec) — plus a secondary "Complete" button beneath it that lets the
 * user finish the task manually at any point, run or not. The play/pause
 * press handler branches on `status` so that's one button whose action
 * changes rather than three separate controls. */
export function TimerTaskControls({ status, disabled, onStart, onPause, onResume, onComplete }: TimerTaskControlsProps) {
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'muted');
  const success = useThemeColor({}, 'success');
  const scale = useSharedValue(1);
  const completeScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const completeAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: completeScale.value }] }));
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
    <View style={styles.column}>
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

      {isCompleted ? null : (
        <Pressable
          onPress={() => {
            if (disabled) return;
            onComplete();
          }}
          onPressIn={() => {
            if (disabled) return;
            completeScale.value = withSpring(0.95, { damping: 14, stiffness: 300 });
          }}
          onPressOut={() => {
            completeScale.value = withSpring(1, { damping: 10, stiffness: 200 });
          }}
          hitSlop={8}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Complete task now">
          <Animated.View style={[styles.completeButton, { borderColor: success, opacity: disabled ? 0.5 : 1 }, completeAnimatedStyle]}>
            <IconSymbol name="checkmark" size={16} color={success} />
            <ThemedText style={[styles.completeLabel, { color: success }]}>Complete</ThemedText>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', justifyContent: 'center', gap: 20 },
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
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  completeLabel: { fontSize: 14, fontWeight: '600' },
});
