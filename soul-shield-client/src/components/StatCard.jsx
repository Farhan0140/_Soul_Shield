import { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { cn } from '../utils/cn';

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

/** Metric tile: label + icon, a large value (numbers count up), and a sub-line.
 * `accent` gives the icon the brand tile, for the headline metric. */
export default function StatCard({ icon: Icon, label, value, suffix = '', sub, accent = false, delay = 0 }) {
  const numericValue = typeof value === 'number' ? value : null;
  const displayValue = useCountUp(numericValue ?? 0);

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="card min-w-0 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="pt-1 text-xs font-medium text-muted">{label}</p>
        {Icon && (
          <span className={cn('icon-tile h-8 w-8', accent && 'icon-tile-accent')}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p
        className="mt-2 truncate text-2xl font-semibold leading-tight tracking-tight tabular-nums text-fg sm:text-[28px]"
        title={typeof value === 'string' ? value : undefined}
      >
        {numericValue !== null ? displayValue : value}
        {suffix && <span className="ml-0.5 text-base font-medium text-muted">{suffix}</span>}
      </p>
      {sub && <p className="mt-1.5 truncate text-xs text-muted">{sub}</p>}
    </m.div>
  );
}
