// Pure (no Expo/React Native imports) so tests/ can run it under plain Node.
//
// Hand-drawn SVG path generators for the Pencil UI style. The reference
// design roughens CSS borders with an SVG feTurbulence/feDisplacementMap
// filter, which react-native-svg can't render natively — so instead the
// wobble is baked into the path itself: bowed edges, slightly-off corners,
// and a stroke that overshoots its own start like a real pencil line.

/** Small deterministic PRNG (mulberry32) — the same size + seed always
 * yields the same wobble, so outlines don't "boil" on every re-render. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();

export interface SketchOptions {
  /** Max random offset (px) applied to each control point. */
  jitter?: number;
  /** Distance (px) the path sits inside the box, so the stroke isn't clipped. */
  inset?: number;
}

/** Spacing (px) between wobble control points. The reference roughens its
 * borders with feTurbulence at baseFrequency 0.035 (a ~28px wavelength);
 * a Catmull–Rom spline through points displaced every ~13px gives the same
 * wiggle. */
const WOBBLE_STEP = 13;

function samplePerimeter(x0: number, y0: number, x1: number, y1: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / WOBBLE_STEP));
    for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  };
  const arc = (cx: number, cy: number, from: number, to: number) => {
    if (r < 1) return;
    const n = Math.max(2, Math.round((r * Math.PI) / 2 / WOBBLE_STEP) + 1);
    for (let i = 0; i < n; i++) {
      const a = from + ((to - from) * i) / n;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  const q = Math.PI / 2;
  line(x0 + r, y0, x1 - r, y0);
  arc(x1 - r, y0 + r, -q, 0);
  line(x1, y0 + r, x1, y1 - r);
  arc(x1 - r, y1 - r, 0, q);
  line(x1 - r, y1, x0 + r, y1);
  arc(x0 + r, y1 - r, q, 2 * q);
  line(x0, y1 - r, x0, y0 + r);
  arc(x0 + r, y0 + r, 2 * q, 3 * q);
  return pts;
}

/** A hand-sketched rounded rectangle filling a `w`×`h` box: the perimeter
 * is sampled densely, every point nudged a little, and a smooth spline
 * drawn through them — starting at a random spot and overshooting its own
 * start, like one continuous pencil stroke. */
export function sketchRectPath(w: number, h: number, radius: number, seed: number, opts: SketchOptions = {}): string {
  const jitter = opts.jitter ?? 1.3;
  const inset = opts.inset ?? 1.8;
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  if (x1 - x0 < 4 || y1 - y0 < 4) return '';

  const rand = seededRandom(seed);
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  const base = samplePerimeter(x0, y0, x1, y1, r);
  const offset = Math.floor(rand() * base.length);
  const ring = base.slice(offset).concat(base.slice(0, offset));
  const pts: [number, number][] = ring.map(([x, y]) => [x + (rand() * 2 - 1) * jitter, y + (rand() * 2 - 1) * jitter]);
  // Overshoot: run back over the start and a little past it.
  const [sx, sy] = ring[0];
  const [nx, ny] = ring[1 % ring.length];
  pts.push([sx + (rand() * 2 - 1) * jitter, sy + (rand() * 2 - 1) * jitter]);
  pts.push([sx + (nx - sx) * 0.7 + (rand() * 2 - 1) * jitter, sy + (ny - sy) * 0.7 + (rand() * 2 - 1) * jitter]);
  return catmullRom(pts);
}

/** A hand-drawn horizontal rule from x0 to x1 at height y. */
export function sketchLinePath(x0: number, x1: number, y: number, seed: number, opts: SketchOptions = {}): string {
  const jitter = opts.jitter ?? 1.1;
  if (x1 - x0 < 4) return '';
  const rand = seededRandom(seed);
  const n = Math.max(2, Math.round((x1 - x0) / WOBBLE_STEP));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y + (rand() * 2 - 1) * jitter]);
  return catmullRom(pts);
}

/** A clean (non-wobbly) rounded rectangle — used as the hatch-fill region. */
export function roundedRectPath(w: number, h: number, radius: number, inset = 1.5): string {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  if (x1 - x0 < 1 || y1 - y0 < 1) return '';
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  return (
    `M${f(x0 + r)} ${f(y0)} H${f(x1 - r)} Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + r)} ` +
    `V${f(y1 - r)} Q${f(x1)} ${f(y1)} ${f(x1 - r)} ${f(y1)} H${f(x0 + r)} ` +
    `Q${f(x0)} ${f(y1)} ${f(x0)} ${f(y1 - r)} V${f(y0 + r)} Q${f(x0)} ${f(y0)} ${f(x0 + r)} ${f(y0)} Z`
  );
}

/** A wobbly ellipse filling a `w`×`h` box, drawn as a single loop that
 * overshoots its start (a quickly-sketched circle). */
export function sketchEllipsePath(w: number, h: number, seed: number, opts: SketchOptions = {}): string {
  const jitter = opts.jitter ?? 1.3;
  const inset = opts.inset ?? 1.8;
  const rx = w / 2 - inset;
  const ry = h / 2 - inset;
  if (rx < 2 || ry < 2) return '';
  const cx = w / 2;
  const cy = h / 2;
  const rand = seededRandom(seed);
  const start = rand() * Math.PI * 2;
  const steps = Math.max(12, Math.round((Math.PI * (rx + ry)) / WOBBLE_STEP));
  const sweep = Math.PI * 2 + 0.45; // overshoot
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + (sweep * i) / steps;
    const wobble = (rand() * 2 - 1) * jitter;
    pts.push([cx + Math.cos(a) * (rx + wobble), cy + Math.sin(a) * (ry + wobble)]);
  }
  return catmullRom(pts);
}

/** Smooth open path through `pts` (Catmull–Rom → cubic Béziers). */
function catmullRom(pts: [number, number][]): string {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** Stable seed for an element of a given size (plus a caller salt). */
export function sizeSeed(w: number, h: number, salt = 0): number {
  return (Math.round(w) * 73856093) ^ (Math.round(h) * 19349663) ^ (salt * 83492791);
}

/** A hand-sketched circle of radius `r` around (cx, cy) — one loop that
 * overshoots its start, wiggling like the outlines. */
export function sketchCirclePath(cx: number, cy: number, r: number, seed: number, opts: SketchOptions = {}): string {
  const jitter = opts.jitter ?? 1.3;
  if (r < 2) return '';
  const rand = seededRandom(seed);
  const start = rand() * Math.PI * 2;
  const steps = Math.max(12, Math.round((2 * Math.PI * r) / WOBBLE_STEP));
  const sweep = Math.PI * 2 + 0.35; // overshoot
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + (sweep * i) / steps;
    const rr = r + (rand() * 2 - 1) * jitter;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return catmullRom(pts);
}

/** Clean ring segment between radii `rInner`..`rOuter`, starting at 12
 * o'clock and running clockwise for `fraction` (0..1) of a full turn — the
 * region a circular progress bar fills. */
export function annularSectorPath(cx: number, cy: number, rOuter: number, rInner: number, fraction: number): string {
  if (!(fraction > 0) || rOuter <= rInner) return '';
  if (fraction >= 0.9999) {
    // Full ring: outer circle clockwise + inner circle counter-clockwise.
    return (
      `M${f(cx)} ${f(cy - rOuter)} A${f(rOuter)} ${f(rOuter)} 0 1 1 ${f(cx)} ${f(cy + rOuter)} ` +
      `A${f(rOuter)} ${f(rOuter)} 0 1 1 ${f(cx)} ${f(cy - rOuter)} Z ` +
      `M${f(cx)} ${f(cy - rInner)} A${f(rInner)} ${f(rInner)} 0 1 0 ${f(cx)} ${f(cy + rInner)} ` +
      `A${f(rInner)} ${f(rInner)} 0 1 0 ${f(cx)} ${f(cy - rInner)} Z`
    );
  }
  const a0 = -Math.PI / 2;
  const a1 = a0 + Math.PI * 2 * fraction;
  const large = fraction > 0.5 ? 1 : 0;
  const pt = (r: number, a: number) => `${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`;
  return (
    `M${pt(rOuter, a0)} A${f(rOuter)} ${f(rOuter)} 0 ${large} 1 ${pt(rOuter, a1)} ` +
    `L${pt(rInner, a1)} A${f(rInner)} ${f(rInner)} 0 ${large} 0 ${pt(rInner, a0)} Z`
  );
}
