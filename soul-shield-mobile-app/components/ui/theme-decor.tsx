import { useId, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Ellipse, Line, Path, Pattern } from 'react-native-svg';

import { useAppTheme } from '@/context/theme-context';
import type { SurfaceKind } from '@/hooks/use-ui-style';
import { hexToRgba } from '@/lib/color';
import type { UIStyleTokens } from '@/lib/ui-style/palette';
import {
  roundedRectPath,
  sizeSeed,
  sketchEllipsePath,
  sketchLinePath,
  sketchRectPath,
} from '@/lib/ui-style/sketch';

/** Surface kinds plus decoration-only shapes:
 * - circle: a round outline with no surface override of its own
 * - rule:   (Pencil) a hand-drawn ink line along the bottom edge — the
 *           reference's thick separators between header and body */
export type DecorKind = SurfaceKind | 'circle' | 'rule';

interface ThemeDecorProps {
  kind: DecorKind;
  /** Pencil: corner radius of the sketched outline (defaults per kind). */
  radius?: number;
  /** Pencil: outline color (default: graphite ink) — e.g. the tint for a
   * focused field, danger for an error, a category color for its chip. */
  stroke?: string;
  /** Pencil: hatching drawn inside the outline. Pass the color this surface
   * would be FILLED with in the other styles (tint, success, danger…): the
   * Pencil style never paints solid fills — it shades them in with that
   * colored pencil, like the reference's hatched bars and active items. */
  hatch?: string;
  /** Pencil: gap (px) between hatch lines — tighter reads darker. */
  hatchSpacing?: number;
  /** Pencil: hatch line thickness (px). */
  hatchWidth?: number;
  /** Pencil: cross-hatch — a second set of lines in the opposite direction,
   * for a denser, "fully shaded" pencil fill. */
  crossHatch?: boolean;
  /** Pencil: draw the outline (default true; false = hatching only). */
  outline?: boolean;
  /** Pencil: dashed outline. */
  dashed?: boolean;
  /** Paper: draw the tape strip (defaults to true for 'note' only). */
  tape?: boolean;
}

const DEFAULT_RADIUS: Record<DecorKind, number> = {
  card: 3,
  note: 3,
  button: 8,
  chip: 6,
  input: 4,
  sheet: 10,
  modal: 6,
  panel: 3,
  fab: 0,
  iconCircle: 0,
  circle: 0,
  tabBar: 3,
  track: 3,
  tag: 2,
  rule: 0,
};

const ELLIPSE_KINDS: DecorKind[] = ['fab', 'iconCircle', 'circle'];

/** Purely decorative layer for a themed surface — render it as the FIRST
 * child of the surface (absolutely positioned, so it never takes part in
 * the parent's layout, gap, or touch handling). Renders nothing under the
 * Normal style.
 * - Paper: a translucent tape strip on top of 'note' cards.
 * - Pencil: the reference wireframe's rough 2.5px ink outline, plus
 *   colored-pencil hatching wherever the other styles use a solid fill. */
export function ThemeDecor({
  kind,
  radius,
  stroke,
  hatch,
  hatchSpacing,
  hatchWidth,
  crossHatch,
  outline,
  dashed,
  tape,
}: ThemeDecorProps) {
  const { styleTokens } = useAppTheme();
  if (styleTokens.style === 'paper') {
    return (tape ?? kind === 'note') ? <PaperTape tokens={styleTokens} /> : null;
  }
  if (styleTokens.style === 'pencil') {
    if (kind === 'rule') return <PencilRule stroke={stroke ?? styleTokens.ink} />;
    return (
      <PencilOutline
        kind={kind}
        radius={radius ?? DEFAULT_RADIUS[kind]}
        stroke={stroke ?? styleTokens.ink}
        // Tags are always shaded in graphite, like the reference's "SUBSCRIBE" label.
        hatch={hatch ?? (kind === 'tag' ? styleTokens.hatch : undefined)}
        hatchSpacing={hatchSpacing ?? (kind === 'tag' ? 5 : 6)}
        hatchWidth={hatchWidth ?? (kind === 'tag' ? 1 : 1.5)}
        crossHatch={crossHatch ?? false}
        outline={outline ?? true}
        dashed={dashed ?? false}
      />
    );
  }
  return null;
}

function PaperTape({ tokens }: { tokens: UIStyleTokens }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.tape, { backgroundColor: tokens.tape, borderColor: hexToRgba(tokens.ink, 0.1) }]}
    />
  );
}

function useBoxSize() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev && Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5 ? prev : { w: width, h: height }
    );
  };
  return { size, onLayout };
}

const STROKE_WIDTH = 2.5;

/** The Pencil style's hand-sketched outline (+ optional hatching) on its
 * own — exported so previews (profile/ui-style-picker.tsx) can draw it
 * whatever the active style is. Fills its parent (absolutely positioned). */
export function PencilOutline({
  kind,
  radius,
  stroke,
  hatch,
  hatchSpacing = 6,
  hatchWidth = 1.5,
  crossHatch = false,
  outline = true,
  dashed = false,
}: {
  kind: DecorKind;
  radius: number;
  stroke: string;
  hatch?: string;
  hatchSpacing?: number;
  hatchWidth?: number;
  crossHatch?: boolean;
  outline?: boolean;
  dashed?: boolean;
}) {
  const { size, onLayout } = useBoxSize();
  const patternId = `hatch${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ellipse = ELLIPSE_KINDS.includes(kind);
  const hatchAngles = crossHatch ? [-45, 45] : [-45];

  const paths = useMemo(() => {
    if (!size) return null;
    const { w, h } = size;
    const seed = sizeSeed(w, h, kind.length);
    // Small controls get a calmer wobble so they don't look broken.
    const jitter = Math.min(w, h) < 36 ? 0.8 : 1.3;
    return {
      main: ellipse ? sketchEllipsePath(w, h, seed, { jitter }) : sketchRectPath(w, h, radius, seed, { jitter }),
      fill: ellipse ? null : roundedRectPath(w, h, radius, 3),
    };
  }, [size, radius, ellipse, kind]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {size && paths ? (
        <Svg width={size.w} height={size.h}>
          {hatch ? (
            <>
              <Defs>
                {hatchAngles.map((angle) => (
                  <Pattern
                    key={angle}
                    id={`${patternId}${angle < 0 ? 'a' : 'b'}`}
                    patternUnits="userSpaceOnUse"
                    width={hatchSpacing}
                    height={hatchSpacing}
                    patternTransform={`rotate(${angle})`}>
                    <Line x1={0} y1={0} x2={0} y2={hatchSpacing} stroke={hatch} strokeWidth={hatchWidth} />
                  </Pattern>
                ))}
              </Defs>
              {hatchAngles.map((angle) => {
                const fill = `url(#${patternId}${angle < 0 ? 'a' : 'b'})`;
                return ellipse ? (
                  <Ellipse
                    key={angle}
                    cx={size.w / 2}
                    cy={size.h / 2}
                    rx={size.w / 2 - 3}
                    ry={size.h / 2 - 3}
                    fill={fill}
                  />
                ) : paths.fill ? (
                  <Path key={angle} d={paths.fill} fill={fill} />
                ) : null;
              })}
            </>
          ) : null}
          {outline ? (
            <Path
              d={paths.main}
              stroke={stroke}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dashed ? '7 5' : undefined}
              fill="none"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

function PencilRule({ stroke }: { stroke: string }) {
  const { size, onLayout } = useBoxSize();
  const d = useMemo(
    () => (size ? sketchLinePath(1.5, size.w - 1.5, size.h - 1.5, sizeSeed(size.w, size.h, 3)) : ''),
    [size]
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {size && d ? (
        <Svg width={size.w} height={size.h}>
          <Path d={d} stroke={stroke} strokeWidth={STROKE_WIDTH} strokeOpacity={0.85} strokeLinecap="round" fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tape: {
    position: 'absolute',
    top: -9,
    left: '50%',
    marginLeft: -30,
    width: 60,
    height: 18,
    borderWidth: 1,
    transform: [{ rotate: '-2deg' }],
    zIndex: 1,
  },
});
