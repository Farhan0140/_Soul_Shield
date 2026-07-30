import { useMemo, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { fmtDate, prettyDate } from '../hooks/useTasks';

// 5 intensity levels based on completion %
function intensity(pct) {
  if (pct === 0) return 0;
  if (pct < 25) return 1;
  if (pct < 50) return 2;
  if (pct < 75) return 3;
  return 4;
}

const COLORS = [
  'bg-slate-100',
  'bg-indigo-100',
  'bg-indigo-300',
  'bg-indigo-500',
  'bg-indigo-700',
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Heatmap({ byDate, range, onDateClick }) {
  const [hovered, setHovered] = useState(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, data: null });

  // Build array of dates in range
  const days = useMemo(() => {
    const arr = [];
    const d = new Date(range.from);
    const end = new Date(range.to);
    while (d <= end) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [range]);

  // Group into weeks (columns)
  const weeks = useMemo(() => {
    const w = [];
    let current = [];
    days.forEach((d, i) => {
      current.push(d);
      if (d.getDay() === 6 || i === days.length - 1) {
        w.push(current);
        current = [];
      }
    });
    return w;
  }, [days]);

  const handleMouseEnter = (e, date) => {
    const key = fmtDate(date);
    const tasks = byDate[key] || [];
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    setHovered(key);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      data: { date, total, completed, pct },
    });
  };

  const handleMouseLeave = () => {
    setHovered(null);
    setTooltip({ show: false, x: 0, y: 0, data: null });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Activity</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {Object.values(byDate).flat().filter(t => t.status === 'completed').length} tasks completed
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span>Less</span>
          {COLORS.map((c, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {/* Day labels column */}
        <div className="flex flex-col gap-1 mr-1 flex-shrink-0">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="h-3.5 text-[10px] text-slate-400 flex items-center">
              {i % 2 === 1 ? d : ''}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-shrink-0">
            {/* Pad first week with empty cells to align by weekday */}
            {wi === 0 && Array.from({ length: week[0].getDay() }).map((_, i) => (
              <div key={`pad-${i}`} className="w-3.5 h-3.5" />
            ))}
            {week.map(date => {
              const key = fmtDate(date);
              const tasks = byDate[key] || [];
              const total = tasks.length;
              const completed = tasks.filter(t => t.status === 'completed').length;
              const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
              const lvl = intensity(pct);
              const isHovered = hovered === key;
              const isToday = fmtDate(date) === fmtDate(new Date());

              return (
                <m.button
                  key={key}
                  onMouseEnter={(e) => handleMouseEnter(e, date)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => onDateClick?.(date)}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-3.5 h-3.5 rounded-sm transition-colors ${COLORS[lvl]}
                    ${isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                    ${isHovered ? 'ring-2 ring-slate-400' : ''}
                  `}
                  aria-label={`${prettyDate(date)}: ${completed}/${total} completed`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip.show && tooltip.data && (
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
            className="pointer-events-none z-50 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
          >
            <p className="font-semibold">{prettyDate(tooltip.data.date)}</p>
            <p className="text-slate-300">
              {tooltip.data.completed}/{tooltip.data.total} completed
              {tooltip.data.total > 0 && ` (${tooltip.data.pct}%)`}
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}