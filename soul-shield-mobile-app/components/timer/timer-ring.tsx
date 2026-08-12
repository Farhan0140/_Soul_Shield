import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

interface TimerRingProps {
  remainingMs: number;
}

function formatHHMMSS(ms: number): string {
  const totalSeconds = ms <= 0 ? 0 : Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** The static circular timer face: a soft outer ring (theme `border`) around
 * a theme-`card` inner circle with a subtle glow, and the HH:MM:SS readout.
 * Purely decorative — countdown progress is communicated by the full-screen
 * tank fill (components/timer/tank-fill.tsx), not an arc on this ring, per
 * the reference screenshot. */
export function TimerRing({ remainingMs }: TimerRingProps) {
  const { width } = useWindowDimensions();
  const borderColor = useThemeColor({}, 'border');
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const outerSize = Math.min(width * 0.72, 300);
  const innerSize = outerSize * 0.78;

  return (
    <View
      style={[
        styles.outer,
        { width: outerSize, height: outerSize, borderRadius: outerSize / 2, backgroundColor: borderColor },
      ]}>
      <View
        style={[
          styles.inner,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: cardColor,
            shadowColor: tintColor,
          },
        ]}>
        <ThemedText style={[styles.digits, { color: textColor, fontFamily: Fonts.mono }]}>
          {formatHHMMSS(remainingMs)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center' },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 10 },
    }),
  },
  digits: { fontSize: 30, letterSpacing: 1 },
});
