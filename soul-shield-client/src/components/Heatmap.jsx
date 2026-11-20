import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence } from 'framer-motion';
import { fmtDate, prettyDate } from '../hooks/useTasks';
import { cn } from '../utils/cn';

// 5 intensity levels based on completion %
function intensity(pct) {
  if (pct === 0) return 0;
  if (pct < 25) return 1;
  if (pct < 50) return 2;
  if (pct < 75) return 3;
  return 4;
}

const COLORS = [
  'bg-sunken',
  'bg-heat-1',
  'bg-heat-2',
  'bg-heat-3',
  'bg-heat-4',
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

  const completedTotal = useMemo(
    () => Object.values(byDate).flat().filter(t => t.status === 'completed').length,
    [byDate]
  );

  const showTooltip = (e, date) => {
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

  const hideTooltip = () => {
    setHovered(null);
    setTooltip({ show: false, x: 0, y: 0, data: null });
  };

  const todayKey = fmtDate(new Date());

  return (
    <section aria-label="Activity heatmap" className="card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Activity</h2>
          <p className="mt-0.5 text-xs text-muted">
            {completedTotal} task{completedTotal === 1 ? '' : 's'} completed · select a day to open it
          </p>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted" aria-hidden="true">
          <span className="mr-0.5">Less</span>
          {COLORS.map((c, i) => (
            <div key={i} className={cn('h-3 w-3 rounded-[3px] ring-1 ring-inset ring-black/[0.04]', c)} />
          ))}
          <span className="ml-0.5">More</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {/* Day labels column */}
        <div className="mr-1 flex shrink-0 flex-col gap-1" aria-hidden="true">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="flex h-3.5 items-center text-[10px] text-subtle">
              {i % 2 === 1 ? d : ''}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex shrink-0 flex-col gap-1">
            {/* Pad first week with empty cells to align by weekday */}
            {wi === 0 && Array.from({ length: week[0].getDay() }).map((_, i) => (
              <div key={`pad-${i}`} className="h-3.5 w-3.5" />
            ))}
            {week.map(date => {
              const key = fmtDate(date);
              const tasks = byDate[key] || [];
              const total = tasks.length;
              const completed = tasks.filter(t => t.status === 'completed').length;
              const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
              const lvl = intensity(pct);
              const isHovered = hovered === key;
              const isToday = key === todayKey;

              return (
                <button
                  type="button"
                  key={key}
                  onMouseEnter={(e) => showTooltip(e, date)}
                  onMouseLeave={hideTooltip}
                  onFocus={(e) => showTooltip(e, date)}
                  onBlur={hideTooltip}
                  onClick={() => onDateClick?.(date)}
                  className={cn(
                    'h-3.5 w-3.5 rounded-[3px] ring-1 ring-inset ring-black/[0.04] transition-transform duration-100 hover:scale-125 focus-visible:scale-125',
                    COLORS[lvl],
                    isToday && 'outline-2 outline-offset-1 outline-fg/50',
                    isHovered && 'scale-125'
                  )}
                  aria-label={`${prettyDate(date)}: ${completed}/${total} completed`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Tooltip — portaled + fixed so no scroll container or transformed
          ancestor can clip or offset it. */}
      {createPortal(
        <AnimatePresence>
          {tooltip.show && tooltip.data && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              style={{
                position: 'fixed',
                left: tooltip.x,
                top: tooltip.y - 8,
                transform: 'translate(-50%, -100%)',
              }}
              className="pointer-events-none z-[120] whitespace-nowrap rounded-lg bg-fg px-3 py-2 text-xs text-bg shadow-lg"
            >
              <p className="font-semibold">{prettyDate(tooltip.data.date)}</p>
              <p className="opacity-75">
                {tooltip.data.completed}/{tooltip.data.total} completed
                {tooltip.data.total > 0 && ` (${tooltip.data.pct}%)`}
              </p>
            </m.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
}
