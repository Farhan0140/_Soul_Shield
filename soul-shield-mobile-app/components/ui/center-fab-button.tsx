import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface CenterFabButtonProps {
  onPress: () => void;
}

/** The raised, oversized "+" button embedded in the tab bar's center slot.
 * Rendered as a custom tabBarButton (see app/(tabs)/_layout.tsx) so it sits
 * in a real flex slot — the slot's default overflow is 'visible', letting the
 * circle pop above the bar without extra absolute-positioning plumbing. */
export function CenterFabButton({ onPress }: CenterFabButtonProps) {
  const tint = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 14, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Create">
      <Animated.View style={[styles.halo, { backgroundColor: background }, animatedStyle]}>
        <Animated.View style={[styles.circle, { backgroundColor: tint }]}>
          <IconSymbol name="plus" size={30} color="#fff" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    top: -34,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
      },
      android: { elevation: 8 },
    }),
  },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
