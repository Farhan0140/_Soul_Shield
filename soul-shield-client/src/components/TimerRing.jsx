/** Circular progress ring for a Timer Task's countdown — plain SVG (no
 * chart library), same math as the mobile app's CounterProgressRing:
 * `progress` is 0..1 and clamped, drawn via strokeDasharray/strokeDashoffset,
 * with the whole <svg> rotated -90deg so the ring starts at 12 o'clock.
 * Colors come from the app's theme tokens (`stroke-primary`/`stroke-border`,
 * see index.css's `@theme` block), so it follows all 9 light/dark palettes
 * automatically — no hardcoded color. */
export default function TimerRing({ progress, size = 260, strokeWidth = 16, children }) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" className="stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="stroke-primary transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
