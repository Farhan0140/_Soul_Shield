import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { ThemeDecor } from '@/components/ui/theme-decor';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useSurface } from '@/hooks/use-ui-style';

export function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.5)).current;
  const cardColor = useThemeColor({}, 'card');
  const lineColor = useThemeColor({}, 'border');
  const surface = useSurface();

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
    <Animated.View style={[styles.card, { backgroundColor: cardColor, opacity }, surface('card')]}>
      <ThemeDecor kind="card" />
      <Animated.View style={[styles.line, styles.title, { backgroundColor: lineColor }]} />
      <Animated.View style={[styles.line, styles.subtitle, { backgroundColor: lineColor }]} />
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
