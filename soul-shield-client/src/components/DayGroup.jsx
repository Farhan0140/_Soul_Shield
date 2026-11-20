import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { prettyDate, fmtDate, parseDateKey } from '../hooks/useTasks';
import { cn } from '../utils/cn';
import TaskCard from './TaskCard';
import { BeadMeter } from './BeadString';

export default function DayGroup({ date, tasks }) {
  const [open, setOpen] = useState(true);

  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const isToday = fmtDate(date) === fmtDate(new Date());

  const partial = tasks.filter(t => t.status === 'partially_completed').length;
  const summary = pct === 100 ? 'All done' : `${pct}%`;

  return (
    <div className="card overflow-hidden">
      {/* Day header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2 sm:px-5"
      >
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[10px] border',
            isToday ? 'border-primary-ink/30 bg-primary-soft text-primary-ink' : 'border-border bg-surface-2 text-fg'
          )}
        >
          <span className="text-[11px] leading-none opacity-80">
            {date.toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <span className="mt-1 text-base leading-none font-medium tabular-nums">
            {date.getDate()}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">
            {prettyDate(date)}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <BeadMeter
              value={completed}
              max={total}
              partial={partial}
              limit={20}
              label={`${completed} of ${total} completed`}
              className="min-w-0"
            />
            <span className="text-xs tabular-nums text-muted">
              {completed}/{total}
            </span>
          </div>
        </div>

        <span className="hidden text-[13px] tabular-nums text-muted sm:inline">{summary}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-subtle transition-transform duration-200', !open && '-rotate-90')} aria-hidden="true" />
      </button>

      {/* Tasks */}
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="grid items-start gap-3 border-t border-border bg-surface-2/60 p-3 sm:p-4 md:grid-cols-2">
              {tasks.map(t => (
                <TaskCard
                  key={t.task_id}
                  task={t}
                  date={parseDateKey(t.date)}
                  isReadOnly
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onUpdate={() => {}}
                />
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
