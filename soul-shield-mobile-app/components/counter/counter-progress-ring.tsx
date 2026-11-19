import { useId, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern } from 'react-native-svg';

import { useUIStyle } from '@/hooks/use-ui-style';
import { annularSectorPath, sizeSeed, sketchCirclePath } from '@/lib/ui-style/sketch';

interface CounterProgressRingProps {
  /** 0..1 — clamped here as a last line of defense so the ring visually never
   * exceeds a full circle even if a caller passes an over-target ratio (the
   * business logic elsewhere may still allow the underlying count itself to
   * exceed the target). */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  children?: ReactNode;
}

export function CounterProgressRing({
  progress,
  size = 260,
  strokeWidth = 18,
  color,
  trackColor,
  children,
}: CounterProgressRingProps) {
  const { uiStyle, tokens } = useUIStyle();
  const clamped = Math.min(Math.max(progress, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {uiStyle === 'pencil' ? (
        <PencilRing size={size} strokeWidth={strokeWidth} progress={clamped} color={color} ink={tokens.ink} />
      ) : (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>
      )}
      <View style={styles.center}>{children}</View>
    </View>
  );
}

/** Gap (px) between cross-hatch lines — tight, for a densely shaded fill. */
const CROSS_HATCH_SPACING = 3.5;

/** Pencil style: no solid band. The track is two hand-sketched ink circles
 * (its outer and inner edge, like the reference wireframe's outlined
 * `.bar`), and the progress is that segment of the track shaded with
 * colored-pencil cross-hatching, closed off by ink ticks at its start and end. */
function PencilRing({
  size,
  strokeWidth,
  progress,
  color,
  ink,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  ink: string;
}) {
  const patternId = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const c = size / 2;
  const rOuter = c - 2;
  const rInner = rOuter - strokeWidth;

  const outlines = useMemo(() => {
    const seed = sizeSeed(size, strokeWidth, 11);
    return { outer: sketchCirclePath(c, c, rOuter, seed), inner: sketchCirclePath(c, c, rInner, seed + 1) };
  }, [size, strokeWidth, c, rOuter, rInner]);

  const fill = annularSectorPath(c, c, rOuter - 1, rInner + 1, progress);
  const tick = (angle: number) => ({
    x1: c + Math.cos(angle) * (rInner - 1),
    y1: c + Math.sin(angle) * (rInner - 1),
    x2: c + Math.cos(angle) * (rOuter + 1),
    y2: c + Math.sin(angle) * (rOuter + 1),
  });
  const start = -Math.PI / 2;
  const showTicks = progress > 0 && progress < 1;

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs>
        {/* Cross-hatching: two line sets at ±45°. */}
        <Pattern id={`${patternId}a`} patternUnits="userSpaceOnUse" width={CROSS_HATCH_SPACING} height={CROSS_HATCH_SPACING} patternTransform="rotate(-45)">
          <Line x1={0} y1={0} x2={0} y2={CROSS_HATCH_SPACING} stroke={color} strokeWidth={1.1} />
        </Pattern>
        <Pattern id={`${patternId}b`} patternUnits="userSpaceOnUse" width={CROSS_HATCH_SPACING} height={CROSS_HATCH_SPACING} patternTransform="rotate(45)">
          <Line x1={0} y1={0} x2={0} y2={CROSS_HATCH_SPACING} stroke={color} strokeWidth={1.1} />
        </Pattern>
      </Defs>
      {fill ? (
        <>
          <Path d={fill} fill={`url(#${patternId}a)`} />
          <Path d={fill} fill={`url(#${patternId}b)`} />
        </>
      ) : null}
      <Path d={outlines.outer} stroke={ink} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d={outlines.inner} stroke={ink} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      {showTicks ? (
        <>
          <Line {...tick(start)} stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
          <Line {...tick(start + Math.PI * 2 * progress)} stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        </>
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
