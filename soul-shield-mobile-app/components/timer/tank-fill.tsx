import { memo, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
  Easing,
  type FrameInfo,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { hexToRgba } from '@/lib/color';
import { useThemeColor } from '@/hooks/use-theme-color';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Points sampled across the screen width per wave layer per update — enough
 * to render the shortest wavelength in use smoothly without costing more
 * trig/path-string/native-SVG-parse work than a mobile UI thread can shrug
 * off on every update. */
const SAMPLE_COUNT = 16;

/** Wave shape recompute is throttled to this rate rather than the device's
 * native frame rate (which can be 60/90/120Hz) — rebuilding 4 SVG path
 * strings and re-parsing them natively on every single display frame is what
 * was causing visible lag. A calm, slow-moving liquid surface looks just as
 * smooth at ~30fps as it does at the display's full rate, so this trades
 * away resolution the eye can't use anyway. The underlying `time` value still
 * advances by the *actual* elapsed duration each update (see the frame
 * callback below), so wave speed itself stays real-time-accurate regardless
 * of this throttle. */
const UPDATE_INTERVAL_MS = 1000 / 30;

interface WaveTerm {
  amplitude: number;
  wavelength: number;
  speed: number;
  phase: number;
}

/** Relative factors (of screen height for amplitude, width for wavelength)
 * so the wave reads consistently across device sizes. Each layer's speeds
 * and wavelengths are deliberately not simple multiples of one another, so
 * the three layers drift in and out of phase with each other continuously
 * rather than repeating a fixed pattern — that's what produces the
 * "sometimes combine into a peak, sometimes flatten" interference look. */
const MAIN_TERM_FACTORS = [
  { ampFactor: 0.014, wavelengthFactor: 0.82, speed: 0.82, phase: 0 },
  { ampFactor: 0.009, wavelengthFactor: 0.47, speed: -0.58, phase: 2.35 },
];
const BACK_TERM_FACTORS = [{ ampFactor: 0.02, wavelengthFactor: 1.3, speed: 0.36, phase: 0.9 }];

function buildTerms(
  factors: { ampFactor: number; wavelengthFactor: number; speed: number; phase: number }[],
  width: number,
  height: number
): WaveTerm[] {
  return factors.map((f) => ({
    amplitude: f.ampFactor * height,
    wavelength: f.wavelengthFactor * width,
    speed: f.speed,
    phase: f.phase,
  }));
}

type Point = { x: number; y: number };

/** Sums every term's sine contribution at a given x — this is the actual
 * wave-interference math: each term is an independent sine with its own
 * amplitude/wavelength/speed/phase, and summing them is what lets two waves
 * combine into a bigger peak at one moment and partially cancel into a
 * flatter surface a few seconds later. */
function sampleWaveY(x: number, baselineY: number, time: number, terms: WaveTerm[]): number {
  'worklet';
  let y = baselineY;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    y += term.amplitude * Math.sin((x / term.wavelength) * Math.PI * 2 + time * term.speed + term.phase);
  }
  return y;
}

function buildWavePoints(width: number, baselineY: number, time: number, terms: WaveTerm[]): Point[] {
  'worklet';
  const points: Point[] = [];
  const step = width / (SAMPLE_COUNT - 1);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const x = i * step;
    points.push({ x, y: sampleWaveY(x, baselineY, time, terms) });
  }
  return points;
}

/** Smooths a polyline into a curved path via the standard "quadratic through
 * midpoints" trick (each raw sample becomes a control point, each segment's
 * midpoint becomes the curve's actual anchor) — cheap, and avoids the
 * faceted look plain line segments would give the wave crest. `closeHeight`,
 * when provided, closes the shape down into the screen's bottom corners so
 * it can be filled as a solid body of water; omit it for an open crest-only
 * stroke line. */
function pointsToPath(points: Point[], closeHeight?: number): string {
  'worklet';
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  if (closeHeight != null) {
    d += ` L ${last.x} ${closeHeight} L ${points[0].x} ${closeHeight} Z`;
  }
  return d;
}

interface TankFillProps {
  /** 0 (empty) .. 1 (full) — always derived from the real timer state in
   * hooks/use-timer.ts, never from its own clock. This is the ONLY thing
   * that determines the water level; the wave shape below is a fully
   * independent, purely decorative animation layered on top of it. Wave
   * *motion* keeps running whenever there's any water on screen — including
   * while paused, like a real body of water that doesn't instantly freeze
   * mid-ripple — and only the level itself is gated on this value (see the
   * frame-callback activation below). */
  progress: number;
}

/** Full-screen, non-interactive background layer. Two independent behaviors,
 * deliberately kept separate per the design brief: `fillLevel` is a single
 * smoothly-animated shared value tracking `progress` (the rising liquid
 * volume), while `time` free-runs every frame via useFrameCallback and drives
 * three independently-parameterized sine layers whose sum is recomputed from
 * scratch each frame (not a static tileable shape sliding sideways) — that's
 * what makes the surface genuinely reshape itself over time rather than just
 * repeat. Every visible edge on screen is one of these computed wave paths;
 * nothing here is ever a flat animated rectangle. */
export const TankFill = memo(function TankFill({ progress }: TankFillProps) {
  const { width, height } = useWindowDimensions();
  const tint = useThemeColor({}, 'tint');

  const fillLevel = useSharedValue(0);
  const time = useSharedValue(0);
  const pendingMs = useSharedValue(0);

  useEffect(() => {
    fillLevel.value = withTiming(progress, { duration: 350, easing: Easing.linear });
  }, [progress, fillLevel]);

  // Wave motion runs whenever there's anything to see (some water on
  // screen), independent of whether the countdown itself is running or
  // paused — see the component doc above. Stays fully inactive at idle
  // (progress 0, nothing rendered) to avoid spending frame-callback cycles
  // on an invisible animation. Real elapsed time is accumulated on every
  // native frame so nothing is lost, but `time` (which every wave layer
  // below reactively recomputes from) is only advanced — and therefore only
  // triggers a recompute — at UPDATE_INTERVAL_MS, not the display's native
  // frame rate.
  //
  // Wrapped in useCallback with a stable dependency array ([pendingMs, time]
  // are useSharedValue refs, whose identity never changes across renders):
  // useFrameCallback's own effect re-registers the entire native frame loop
  // whenever this callback's identity changes, so an inline arrow function
  // here would tear down and restart the animation on every re-render of
  // this component — including ones caused by unrelated state elsewhere on
  // the screen (e.g. the duration picker's water-contrast color swap) —
  // which is exactly what made the wave visibly stutter/pause.
  //
  // Needs an explicit 'worklet' directive: Reanimated's babel plugin only
  // auto-detects a worklet from a function literal written directly inline
  // at a recognized hook call site (e.g. useFrameCallback(() => {...})) —
  // routing it through useCallback first means the plugin no longer sees it
  // that way, so without this directive it's passed to the UI thread as a
  // plain (non-worklet) closure, which is what caused the
  // "callback is not a function (it is object)" crash.
  const onFrame = useCallback(
    (frameInfo: FrameInfo) => {
      'worklet';
      const delta = frameInfo.timeSincePreviousFrame;
      if (!delta) return;
      pendingMs.value += delta;
      if (pendingMs.value >= UPDATE_INTERVAL_MS) {
        time.value += pendingMs.value / 700;
        pendingMs.value = 0;
      }
    },
    [pendingMs, time]
  );
  const frameCallback = useFrameCallback(onFrame, false);

  useEffect(() => {
    if (progress > 0 && !frameCallback.isActive) frameCallback.setActive(true);
  }, [progress, frameCallback]);

  const mainTerms = useMemo(() => buildTerms(MAIN_TERM_FACTORS, width, height), [width, height]);
  const backTerms = useMemo(() => buildTerms(BACK_TERM_FACTORS, width, height), [width, height]);

  const mainPoints = useDerivedValue(() =>
    buildWavePoints(width, height * (1 - fillLevel.value), time.value, mainTerms)
  );

  const backProps = useAnimatedProps(() => {
    const points = buildWavePoints(width, height * (1 - fillLevel.value) - 8, time.value, backTerms);
    return { d: pointsToPath(points, height) };
  });
  const mainFillProps = useAnimatedProps(() => ({ d: pointsToPath(mainPoints.value, height) }));
  const gradientId = 'timerTankMainGradient';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Each layer's path fills all the way down to the bottom of the
          screen (not just a thin band at its own wave crest), so they
          overlap almost completely everywhere except right at the surface —
          three semi-transparent fills stacked on top of each other there
          compound multiplicatively (alpha compositing), which is why the
          "solid" body of water reads much darker than any single layer's
          alpha suggests. Each alpha below is kept low enough that the
          *combined* stacked look is what stays light and theme-tinted. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={hexToRgba(tint, 0.022)} />
            <Stop offset="1" stopColor={hexToRgba(tint, 0.7)} />
          </LinearGradient>
        </Defs>
        <AnimatedPath animatedProps={backProps} fill={hexToRgba(tint, 0.4)} />
        <AnimatedPath animatedProps={mainFillProps} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
});
