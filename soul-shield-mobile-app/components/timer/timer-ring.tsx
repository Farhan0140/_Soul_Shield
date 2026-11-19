import { useId, useMemo } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Line, Path, Pattern } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useUIStyle } from '@/hooks/use-ui-style';
import { annularSectorPath, sizeSeed, sketchCirclePath } from '@/lib/ui-style/sketch';

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
  const { uiStyle, tokens } = useUIStyle();
  const pencil = uiStyle === 'pencil';

  const outerSize = Math.min(width * 0.72, 300);
  const innerSize = outerSize * 0.78;

  return (
    <View
      style={[
        styles.outer,
        { width: outerSize, height: outerSize, borderRadius: outerSize / 2, backgroundColor: borderColor },
        pencil && styles.clear,
      ]}>
      {pencil ? <PencilFrame outerSize={outerSize} innerSize={innerSize} ink={tokens.ink} hatch={tokens.hatch} /> : null}
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
          pencil && styles.flatInner,
        ]}>
        <ThemedText style={[styles.digits, { color: textColor, fontFamily: Fonts.mono }]}>
          {formatHHMMSS(remainingMs)}
        </ThemedText>
      </View>
    </View>
  );
}

/** Pencil style: the solid band becomes a hand-sketched double circle with
 * the gap between shaded in graphite — a plain frame, so a single sparse
 * hatch (cross-hatching is reserved for actual progress fills). */
function PencilFrame({
  outerSize,
  innerSize,
  ink,
  hatch,
}: {
  outerSize: number;
  innerSize: number;
  ink: string;
  hatch: string;
}) {
  const patternId = `frame${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const c = outerSize / 2;
  const rOuter = c - 2;
  // Just outside the (opaque) inner face drawn on top, so the whole stroke shows.
  const rInner = innerSize / 2 + 1.5;
  const paths = useMemo(() => {
    const seed = sizeSeed(outerSize, innerSize, 5);
    return {
      outer: sketchCirclePath(c, c, rOuter, seed),
      inner: sketchCirclePath(c, c, rInner, seed + 1),
      band: annularSectorPath(c, c, rOuter - 1, rInner + 1, 1),
    };
  }, [outerSize, innerSize, c, rOuter, rInner]);

  return (
    <Svg width={outerSize} height={outerSize} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id={patternId} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(-45)">
          <Line x1={0} y1={0} x2={0} y2={6} stroke={hatch} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Path d={paths.band} fill={`url(#${patternId})`} />
      <Path d={paths.outer} stroke={ink} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d={paths.inner} stroke={ink} strokeWidth={2.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  clear: { backgroundColor: 'transparent' },
  flatInner: { shadowOpacity: 0, elevation: 0 },
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
