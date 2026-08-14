import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface MainIncrementButtonProps {
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  color: string;
}

/** The dedicated page's primary interaction — a large +1 tap target sized for
 * comfortable repeated use. Calls the same increment path every other control
 * on this page uses (see app/counter/[taskId].tsx); this component owns only
 * the press animation/haptic, not any counting logic. */
export function MainIncrementButton({ onPress, disabled, size = 172, color }: MainIncrementButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    onPress();
  }, [onPress, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        disabled={disabled}
        onPress={handlePress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add 1"
        style={({ pressed }) => [
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}>
        <ThemedText style={styles.label}>+1</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
  },
  label: { color: '#fff', fontSize: 42, fontWeight: '800' },
});
