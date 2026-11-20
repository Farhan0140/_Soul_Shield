/** Circular progress ring for a Timer Task's countdown — plain SVG (no
 * chart library), same math as the mobile app's CounterProgressRing:
 * `progress` is 0..1 and clamped, drawn via strokeDasharray/strokeDashoffset,
 * with the whole <svg> rotated -90deg so the ring starts at 12 o'clock.
 * Colors come from the theme tokens, so it follows light and dark mode. The
 * face sits on a slightly sunken disc for a touch of depth. */
export default function TimerRing({ progress, size = 260, strokeWidth = 16, children }) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);
  const inset = strokeWidth + 10;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label="Timer progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div
        className="absolute rounded-full border border-border bg-surface-2 shadow-[inset_0_2px_6px_rgba(17,18,20,0.06)]"
        style={{ inset }}
        aria-hidden="true"
      />
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" className="stroke-sunken" />
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
