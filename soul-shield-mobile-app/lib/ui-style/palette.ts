// Pure (no Expo/React Native imports) so tests/ can run it under plain Node.

/** The three visual UI styles. Orthogonal to the color palette (constants/
 * theme.ts): a palette picks the colors, a UI style picks how surfaces are
 * drawn — so every palette works under every style.
 * - normal: the original look (the palette is used exactly as-is).
 * - paper:  ruled notebook paper, sticky-note cards, ink outlines, hard
 *           offset shadows, handwritten fonts.
 * - pencil: a hand-sketched wireframe — graphite outlines, colored-pencil
 *           hatching for filled/active controls, handwritten fonts. */
export type UIStyleName = 'normal' | 'paper' | 'pencil';

export const UI_STYLES: readonly UIStyleName[] = ['normal', 'paper', 'pencil'];
export const DEFAULT_UI_STYLE: UIStyleName = 'normal';

export function isUIStyleName(value: unknown): value is UIStyleName {
  return typeof value === 'string' && (UI_STYLES as readonly string[]).includes(value);
}

/** Same shape as every palette in constants/theme.ts. */
export interface PaletteColors {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  success: string;
  danger: string;
  warning: string;
  muted: string;
  border: string;
  card: string;
  missedTint: string;
  completedTint: string;
  partiallyCompletedTint: string;
  categoryFallback: string;
}

export type Scheme = 'light' | 'dark';

/** Extra, style-specific colors that the palette tokens don't cover. */
export interface UIStyleTokens {
  style: UIStyleName;
  /** paper || pencil — handwritten fonts and drawn decorations apply. */
  handDrawn: boolean;
  /** Pen / graphite color for outlines. */
  ink: string;
  /** Paper: the lighter sticky-note fill. Pencil: a faint colored-pencil wash of the tint. */
  noteLight: string;
  /** Paper: dashed borders + the hard offset shadow under buttons. Pencil: the colored-pencil stroke. */
  noteDeep: string;
  /** Paper: the ruled-line color of the notebook backdrop. */
  ruleLine: string;
  /** Pencil: graphite hatching color. */
  hatch: string;
  /** Paper: the translucent tape strip stuck on top of note cards. */
  tape: string;
  /** Foreground for content sitting on an accent-filled control (primary
   * button label, active chip, FAB icon). White under Normal/Paper; under
   * Pencil fills are redrawn as colored-pencil hatching on bare paper, so
   * content is written in ink instead. */
  onAccent: string;
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function toHex(n: number) {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');
}

/** Linear blend of two `#RRGGBB`/`#RGB` colors: `amount` 0 → `a`, 1 → `b`. */
export function mixHex(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = Math.min(1, Math.max(0, amount));
  return `#${toHex(ca.r + (cb.r - ca.r) * t)}${toHex(ca.g + (cb.g - ca.g) * t)}${toHex(ca.b + (cb.b - ca.b) * t)}`.toUpperCase();
}

const WHITE = '#FFFFFF';
/** Reference sketch-paper colors (Sketch Wireframe reference: --paper / --ink). */
const SKETCH_PAPER_LIGHT = '#FBFAF7';
const SKETCH_INK_LIGHT = '#1D1D1D';
const SKETCH_PAPER_DARK = '#1C1C1A';
const SKETCH_INK_DARK = '#ECECE6';
const SKETCH_SOFT_LIGHT = '#6B6B6B';
const SKETCH_SOFT_DARK = '#9A9A94';
/** Reference --hatch: graphite hatching color. */
const SKETCH_HATCH_LIGHT = '#3A3A3A';
const SKETCH_HATCH_DARK = '#CFCFC8';

/** Derives the colors a UI style actually renders with from the selected
 * palette. `normal` returns the palette untouched — the original look is
 * never altered. The accent (tint), status colors (success/danger/warning)
 * and category colors are always kept, so the user's color choice stays
 * recognizable; only surfaces (background/card/border/text) are re-derived
 * into paper or sketch form. */
export function adaptPalette(palette: PaletteColors, scheme: Scheme, style: UIStyleName): PaletteColors {
  if (style === 'normal') return palette;
  const dark = scheme === 'dark';

  if (style === 'paper') {
    // Light: near-white notebook paper with a whisper of the palette's
    // background, cards are sticky notes in the tint color. Dark: the same
    // idea on the palette's own dark paper.
    const base = dark ? palette.background : WHITE;
    return {
      ...palette,
      background: dark ? mixHex(palette.background, palette.card, 0.35) : mixHex(palette.background, WHITE, 0.65),
      card: mixHex(base, palette.tint, dark ? 0.24 : 0.28),
      border: mixHex(base, palette.tint, dark ? 0.5 : 0.5),
    };
  }

  // pencil — the reference wireframe is strictly monochrome: graphite ink
  // on off-white sketch paper (or its dark variant), every surface the bare
  // paper itself. The selected palette survives as the colored pencil: the
  // tint (and status/category colors) is what hatching, active states and
  // accent strokes are drawn with; light vs dark palettes pick the paper.
  const paper = dark ? SKETCH_PAPER_DARK : SKETCH_PAPER_LIGHT;
  const ink = dark ? SKETCH_INK_DARK : SKETCH_INK_LIGHT;
  const soft = dark ? SKETCH_SOFT_DARK : SKETCH_SOFT_LIGHT;
  return {
    ...palette,
    text: ink,
    background: paper,
    card: paper,
    border: mixHex(ink, paper, 0.45),
    muted: soft,
    icon: soft,
    tabIconDefault: soft,
    // Status cards: the faintest colored-pencil wash over the paper.
    completedTint: mixHex(paper, palette.success, 0.1),
    missedTint: mixHex(paper, palette.danger, 0.1),
    partiallyCompletedTint: mixHex(paper, palette.warning, 0.1),
  };
}

/** Style-specific extra colors, derived from the ADAPTED palette. */
export function buildStyleTokens(adapted: PaletteColors, scheme: Scheme, style: UIStyleName): UIStyleTokens {
  const dark = scheme === 'dark';
  const base = style === 'paper' && !dark ? WHITE : adapted.background;
  return {
    style,
    handDrawn: style !== 'normal',
    ink: adapted.text,
    noteLight: mixHex(base, adapted.tint, style === 'pencil' ? 0.14 : 0.12),
    noteDeep: style === 'pencil' ? adapted.tint : mixHex(base, adapted.tint, 0.55),
    ruleLine: mixHex(base, adapted.tint, dark ? 0.16 : 0.15),
    hatch:
      style === 'pencil' ? (dark ? SKETCH_HATCH_DARK : SKETCH_HATCH_LIGHT) : mixHex(adapted.text, adapted.background, 0.25),
    tape: dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.7)',
    onAccent: style === 'pencil' ? adapted.text : '#FFFFFF',
  };
}
