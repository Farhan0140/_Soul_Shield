import { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';

// Animated number counter
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = 0;
    startRef.current = null;
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export default function StatCard({ icon: Icon, label, value, suffix = '', sub, gradient, delay = 0 }) {
  const numericValue = typeof value === 'number' ? value : null;
  const displayValue = useCountUp(numericValue ?? 0);

  return (
    <m.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 20 }}
      whileHover={{ y: -4 }}
      className="relative bg-white rounded-2xl border border-slate-200 p-5 overflow-hidden group"
    >
      {/* Decorative blob */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all duration-500`} />

      <div className="relative">
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} mb-3 shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-bold text-slate-800 mt-1 tabular-nums">
          {numericValue !== null ? displayValue : value}
          {suffix && <span className="text-lg text-slate-400 ml-0.5">{suffix}</span>}
        </p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </m.div>
  );
}