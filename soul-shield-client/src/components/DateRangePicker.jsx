import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { fmtDate, prettyDate } from '../hooks/useTasks';

const PRESETS = [
  { key: '7d',  label: 'Last 7 days',  days: 6 },
  { key: '30d', label: 'Last 30 days', days: 29 },
  { key: '90d', label: 'Last 90 days', days: 89 },
  { key: 'this_week', label: 'This week', special: 'week' },
  { key: 'this_month', label: 'This month', special: 'month' },
];

export default function DateRangePicker({ range, setRange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const applyPreset = (preset) => {
    const today = new Date();
    let from, to = new Date(today);

    if (preset.special === 'week') {
      from = new Date(today);
      from.setDate(today.getDate() - today.getDay()); // Sunday
    } else if (preset.special === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      from = new Date(today);
      from.setDate(today.getDate() - preset.days);
    }
    setRange({ from, to });
    setOpen(false);
  };

  const handleFromChange = (val) => {
    const d = new Date(val);
    if (!isNaN(d) && d <= range.to) setRange({ ...range, from: d });
  };
  const handleToChange = (val) => {
    const d = new Date(val);
    if (!isNaN(d) && d >= range.from) setRange({ ...range, to: d });
  };

  return (
    <div className="relative" ref={ref}>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl
          hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-slate-700"
      >
        <Calendar className="w-4 h-4 text-indigo-500" />
        <span>{prettyDate(range.from)} — {prettyDate(range.to)}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-30"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Date range</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Custom inputs */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">From</label>
                <input
                  type="date"
                  value={fmtDate(range.from)}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">To</label>
                <input
                  type="date"
                  value={fmtDate(range.to)}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick select</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map(p => (
                  <motion.button
                    key={p.key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => applyPreset(p)}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition-colors text-left"
                  >
                    {p.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}