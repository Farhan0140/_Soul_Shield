import { useId, useMemo } from 'react';

// A tasbih hanging on its cord: one bead per deed. Completed beads are slid to
// the left, as you would move counted beads along a real string, so the gap
// travels to the right as the day fills up. Partly done deeds sit just past
// the gap in brass; the rest wait in stone. The larger "imam" bead and tassel
// close the strand on the right.

const W = 720;
const H = 176;
const TOP = 52;        // height of the strand's two ends
const SAG = 52;        // how far the middle hangs below the ends
const X0 = 24;
const X1 = W - 84;     // the strand ends here; the imam bead hangs past it
const MAX_BEADS = 33;  // one round of a tasbih

function curvePoint(t) {
  // Quadratic Bézier: ends at (X0, TOP) and (X1, TOP), control point below the middle.
  const cx = (X0 + X1) / 2;
  const cy = TOP + SAG * 2;
  const u = 1 - t;
  return {
    x: u * u * X0 + 2 * u * t * cx + t * t * X1,
    y: u * u * TOP + 2 * u * t * cy + t * t * TOP,
  };
}

// Arc-length table, so beads sit evenly along the curve.
const SAMPLES = (() => {
  const pts = [];
  let len = 0;
  let prev = curvePoint(0);
  for (let i = 0; i <= 240; i++) {
    const p = curvePoint(i / 240);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    pts.push({ ...p, len });
    prev = p;
  }
  return pts;
})();
const LENGTH = SAMPLES[SAMPLES.length - 1].len;

function pointAt(s) {
  const target = Math.max(0, Math.min(LENGTH, s));
  let lo = 0;
  let hi = SAMPLES.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (SAMPLES[mid].len < target) lo = mid;
    else hi = mid;
  }
  const a = SAMPLES[lo];
  const b = SAMPLES[hi];
  const k = b.len === a.len ? 0 : (target - a.len) / (b.len - a.len);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

const CURVE_D = `M ${X0} ${TOP} Q ${(X0 + X1) / 2} ${TOP + SAG * 2} ${X1} ${TOP}`;

function Gradient({ id, kind }) {
  return (
    <radialGradient id={id} cx="0.36" cy="0.32" r="0.78" fx="0.32" fy="0.26">
      <stop offset="0" style={{ stopColor: `var(--bead-${kind}-hi)` }} />
      <stop offset="0.46" style={{ stopColor: `var(--bead-${kind}-mid)` }} />
      <stop offset="1" style={{ stopColor: `var(--bead-${kind}-lo)` }} />
    </radialGradient>
  );
}

/** Splits `total` deeds into at most 33 beads, keeping the proportions. */
function toBeads(total, completed, partial) {
  if (total <= 0) return { n: 0, done: 0, part: 0 };
  const n = Math.min(total, MAX_BEADS);
  if (n === total) return { n, done: completed, part: partial };
  const done = Math.round((completed / total) * n);
  const part = Math.min(n - done, Math.round((partial / total) * n));
  return { n, done, part };
}

export default function BeadString({ total, completed, partial = 0, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const { n, done, part } = toBeads(total, completed, partial);

  const beads = useMemo(() => {
    if (n === 0) return [];
    const gapRatio = 0.14;
    const travel = 1.5; // the empty stretch between counted and uncounted beads, in bead widths
    const d = Math.min(40, (LENGTH - 40) / (n * (1 + gapRatio) + travel));
    const used = n * d + (n - 1) * d * gapRatio + travel * d;
    const start = (LENGTH - used) / 2; // beads gather at the low point of the strand
    return Array.from({ length: n }, (_, i) => {
      const s = start + d / 2 + i * d * (1 + gapRatio) + (i >= done ? travel * d : 0);
      const kind = i < done ? 'done' : i < done + part ? 'part' : 'todo';
      return { ...pointAt(s), r: d / 2, kind };
    });
  }, [n, done, part]);

  const imamX = X1 + 34;
  const imamY = TOP + 30;

  const label = total === 0
    ? 'No deeds scheduled'
    : `${completed} of ${total} deeds done${partial ? `, ${partial} partly done` : ''}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <Gradient id={`${uid}-done`} kind="done" />
        <Gradient id={`${uid}-part`} kind="part" />
        <Gradient id={`${uid}-todo`} kind="todo" />
        <linearGradient id={`${uid}-imam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--bead-part-lo)' }} />
          <stop offset="0.3" style={{ stopColor: 'var(--bead-part-hi)' }} />
          <stop offset="0.62" style={{ stopColor: 'var(--bead-part-mid)' }} />
          <stop offset="1" style={{ stopColor: 'var(--bead-part-lo)' }} />
        </linearGradient>
        <filter id={`${uid}-shadow`} x="-10%" y="-30%" width="120%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="6" style={{ floodColor: 'var(--bead-shadow)' }} floodOpacity="0.55" />
        </filter>
      </defs>

      <g filter={`url(#${uid}-shadow)`}>
        {/* Cord: the strand, then down to the imam bead. */}
        <path d={CURVE_D} fill="none" style={{ stroke: 'var(--bead-cord)' }} strokeWidth="1.6" strokeLinecap="round" />
        <path
          d={`M ${X1} ${TOP} C ${X1 + 14} ${TOP - 4}, ${imamX} ${TOP + 2}, ${imamX} ${imamY - 16}`}
          fill="none"
          style={{ stroke: 'var(--bead-cord)' }}
          strokeWidth="1.6"
        />
        <circle cx={X0} cy={TOP} r="3.5" style={{ fill: 'var(--bead-part-mid)' }} />

        {beads.map((b, i) => (
          <g
            key={i}
            style={{
              transform: `translate(${b.x}px, ${b.y}px)`,
              transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <circle r={b.r} fill={`url(#${uid}-${b.kind})`} />
            <ellipse cx={-b.r * 0.34} cy={-b.r * 0.4} rx={b.r * 0.3} ry={b.r * 0.18} fill="#fff" opacity="0.5" transform={`rotate(-28 ${-b.r * 0.34} ${-b.r * 0.4})`} />
          </g>
        ))}

        {/* Imam bead and tassel */}
        <rect x={imamX - 5} y={imamY - 18} width="10" height="5" rx="2" style={{ fill: 'var(--bead-part-mid)' }} />
        <ellipse cx={imamX} cy={imamY} rx="10" ry="15" fill={`url(#${uid}-imam)`} />
        <ellipse cx={imamX - 3.5} cy={imamY - 6} rx="2.2" ry="5" fill="#fff" opacity="0.45" />
        <rect x={imamX - 4} y={imamY + 14} width="8" height="7" rx="2" style={{ fill: 'var(--bead-part-lo)' }} />
        {[-9, -6, -3, 0, 3, 6, 9].map((dx) => (
          <path
            key={dx}
            d={`M ${imamX + dx * 0.3} ${imamY + 20} Q ${imamX + dx * 0.6} ${imamY + 42}, ${imamX + dx} ${imamY + 62}`}
            fill="none"
            style={{ stroke: 'var(--bead-part-mid)' }}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
}

/** Small inline bead row (history days, counters). `value` of `max`, drawn
 * with up to `limit` beads; each bead stands for max/limit when max is larger. */
export function BeadMeter({ value, max, partial = 0, limit = 33, label, className = '' }) {
  const n = Math.max(1, Math.min(max, limit));
  const done = max <= 0 ? 0 : Math.min(n, Math.floor((value / max) * n + 1e-9));
  const part = max <= 0 ? 0 : Math.min(n - done, Math.round((partial / max) * n));
  return (
    <div
      className={`flex w-full items-center gap-[3px] ${className}`}
      style={{ maxWidth: n * 15 }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={`bead min-w-0 flex-1 basis-0 ${i < done ? 'bead-done' : i < done + part ? 'bead-part' : 'bead-todo'}`}
          style={{ maxWidth: 12 }}
        />
      ))}
    </div>
  );
}
