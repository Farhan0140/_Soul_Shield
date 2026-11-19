import { useCallback, useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';

import { HAND_FONTS } from '@/constants/ui-style';
import { useAppTheme } from '@/context/theme-context';
import { hexToRgba } from '@/lib/color';
import type { PaletteColors, UIStyleTokens } from '@/lib/ui-style/palette';

/** Which kind of surface a style override is for. Each existing component
 * keeps its own layout/StyleSheet; it only appends `surface(kind)` to its
 * style array (and, where drawn decoration is needed, renders a
 * <ThemeDecor kind=… /> as its first child).
 * - card:       content rows/cards (category rows, profile rows, list items)
 * - note:       a prominent card — Paper draws it as a taped sticky note
 * - button:     push buttons (primary/secondary/destructive)
 * - chip:       small pills, toggles, badges, segmented options
 * - input:      text fields
 * - sheet:      bottom sheets
 * - modal:      centered dialog cards
 * - panel:      grouping containers (dashed columns in the Paper reference)
 * - fab:        the round center create button
 * - iconCircle: round icon backgrounds
 * - tabBar:     the floating tab bar
 * - track:      (Pencil only) progress-bar tracks — drawn as an outlined bar
 * - tag:        (Pencil only) section-title labels — drawn as a hatched tag */
export type SurfaceKind =
  | 'card'
  | 'note'
  | 'button'
  | 'chip'
  | 'input'
  | 'sheet'
  | 'modal'
  | 'panel'
  | 'fab'
  | 'iconCircle'
  | 'tabBar'
  | 'track'
  | 'tag';

const NO_SHADOW: ViewStyle = {
  boxShadow: 'none',
  elevation: 0,
  shadowOpacity: 0,
};

function paperSurfaces(t: UIStyleTokens, p: PaletteColors): Partial<Record<SurfaceKind, ViewStyle>> {
  const soft = `2px 3px 0px ${hexToRgba(t.ink, 0.12)}, 6px 10px 18px ${hexToRgba(t.ink, 0.12)}`;
  const hard = (x: number, y: number) => `${x}px ${y}px 0px ${t.noteDeep}`;
  const noteCorners: ViewStyle = {
    borderRadius: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 18,
  };
  // The reference's hand-cut button: every corner a slightly different radius.
  const handCorners: ViewStyle = {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 7,
    borderBottomLeftRadius: 12,
  };
  return {
    card: { ...NO_SHADOW, ...noteCorners, borderWidth: 0, boxShadow: soft },
    note: { ...NO_SHADOW, ...noteCorners, borderWidth: 0, boxShadow: soft },
    button: { ...NO_SHADOW, ...handCorners, borderWidth: 2, borderColor: t.ink, boxShadow: hard(4, 4) },
    chip: { ...handCorners, borderWidth: 1.5, borderColor: t.ink },
    input: { borderRadius: 6, borderWidth: 1.5, borderColor: t.ink },
    sheet: {
      ...NO_SHADOW,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      borderWidth: 2,
      borderBottomWidth: 0,
      borderColor: t.ink,
    },
    modal: { ...NO_SHADOW, ...noteCorners, borderBottomRightRadius: 24, borderWidth: 2, borderColor: t.ink, boxShadow: hard(5, 6) },
    // The reference's dashed board column: plain paper, so the sticky-note
    // cards inside it stand out. Opaque on purpose — Insights captures its
    // panel as a shareable image (react-native-view-shot).
    panel: {
      ...NO_SHADOW,
      borderRadius: 10,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: t.noteDeep,
      backgroundColor: p.background,
    },
    fab: { ...NO_SHADOW, borderWidth: 2, borderColor: t.ink, boxShadow: hard(3, 4) },
    iconCircle: { borderRadius: 4, borderBottomRightRadius: 12, borderWidth: 1.5, borderColor: t.ink },
    tabBar: {
      ...NO_SHADOW,
      borderRadius: 12,
      borderWidth: 2,
      borderTopWidth: 2,
      borderColor: t.ink,
      borderTopColor: t.ink,
      boxShadow: hard(4, 4),
    },
  };
}

function pencilSurfaces(p: PaletteColors): Record<SurfaceKind, ViewStyle> {
  // The reference wireframe never paints solid fills or shadows: every
  // surface is bare paper with a rough ink outline (drawn by <ThemeDecor>),
  // and what would be a filled control is shaded with hatching instead. So
  // native borders/shadows are off, and controls that other styles fill
  // with the accent color (buttons, chips, the FAB, icon discs) go clear.
  const flat: ViewStyle = { ...NO_SHADOW, borderWidth: 0 };
  const clear: ViewStyle = { ...flat, backgroundColor: 'transparent' };
  return {
    card: { ...flat, borderRadius: 3 },
    note: { ...flat, borderRadius: 3 },
    button: { ...clear, borderRadius: 8 },
    chip: { ...clear, borderRadius: 6 },
    input: { ...clear, borderRadius: 4 },
    sheet: { ...flat, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
    modal: { ...flat, borderRadius: 6 },
    panel: { ...flat, borderRadius: 3, backgroundColor: p.background },
    // Paper-backed (not clear): the FABs overlap other outlines.
    fab: { ...flat, backgroundColor: p.background },
    iconCircle: { ...clear },
    tabBar: { ...flat, borderTopWidth: 0, borderRadius: 3, backgroundColor: p.background },
    // The reference's `.bar`: a taller outlined bar whose filled part is hatched.
    track: { ...clear, borderRadius: 3, height: 14 },
    tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3 },
  };
}

/** Active UI style plus its extra tokens. */
export function useUIStyle() {
  const { uiStyle, setUIStyle, styleTokens, palette } = useAppTheme();
  return { uiStyle, setUIStyle, tokens: styleTokens, palette, handDrawn: styleTokens.handDrawn };
}

/** Returns `surface(kind)` — the style override for that kind of surface
 * under the active UI style, to append LAST in a component's style array.
 * Always `undefined` under the Normal style, so the original look is never
 * touched. */
export function useSurface() {
  const { styleTokens, palette } = useAppTheme();
  const table = useMemo(() => {
    if (styleTokens.style === 'paper') return paperSurfaces(styleTokens, palette);
    if (styleTokens.style === 'pencil') return pencilSurfaces(palette);
    return null;
  }, [styleTokens, palette]);
  return useCallback((kind: SurfaceKind): ViewStyle | undefined => table?.[kind], [table]);
}

/** Color for content on an accent-filled control (labels on primary
 * buttons, active chips, FAB icons): white, except under Pencil where the
 * fill becomes hatching on bare paper and content is drawn in ink. */
export function useOnAccent(): string {
  return useAppTheme().styleTokens.onAccent;
}

/** Handwritten font styles for raw <Text>/<TextInput> (ThemedText applies
 * these itself). `undefined` under the Normal style. `body` is for UI/body
 * text, `heading` for big headings (Caveat runs small, so callers should
 * size it up — see ThemedText). */
export function useHandFont(): { body?: TextStyle; heading?: TextStyle } {
  const { styleTokens } = useAppTheme();
  return useMemo(
    () =>
      styleTokens.handDrawn
        ? {
            body: { fontFamily: HAND_FONTS.body, fontWeight: 'normal' },
            heading: { fontFamily: HAND_FONTS.heading, fontWeight: 'normal' },
          }
        : {},
    [styleTokens.handDrawn]
  );
}
