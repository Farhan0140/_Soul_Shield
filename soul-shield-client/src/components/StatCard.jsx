import { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';

// Animated number counter
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = 0;
    startRef.current = null;
    const frameRef = { current: null };
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

/** Metric tile: a label, a large figure (numbers count up) and a sub-line.
 * Numbers only — `icon` and `accent` are accepted for compatibility and ignored. */
// eslint-disable-next-line no-unused-vars
export default function StatCard({ icon, label, value, suffix = '', sub, accent = false, delay = 0 }) {
  const numericValue = typeof value === 'number' ? value : null;
  const displayValue = useCountUp(numericValue ?? 0);

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="card min-w-0 p-5"
    >
      <p className="text-[13px] text-muted">{label}</p>
      <p
        className="mt-3 truncate text-[28px] leading-none font-medium tabular-nums text-fg sm:text-[32px]"
        title={typeof value === 'string' ? value : undefined}
      >
        {numericValue !== null ? displayValue : value}
        {suffix && <span className="ml-0.5 text-lg text-muted">{suffix}</span>}
      </p>
      {sub && <p className="mt-2 truncate text-xs text-muted">{sub}</p>}
    </m.div>
  );
}
