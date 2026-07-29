import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.5)).current;
  const cardColor = useThemeColor({}, 'card');

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { backgroundColor: cardColor, opacity }]}>
      <Animated.View style={[styles.line, styles.title, { backgroundColor: cardColor }]} />
      <Animated.View style={[styles.line, styles.subtitle, { backgroundColor: cardColor }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 84,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 16,
    gap: 8,
    justifyContent: 'center',
  },
  line: { height: 12, borderRadius: 6, opacity: 0.6 },
  title: { width: '60%' },
  subtitle: { width: '40%' },
});
