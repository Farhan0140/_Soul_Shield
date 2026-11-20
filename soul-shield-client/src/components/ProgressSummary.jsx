import { m } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import Badge from './ui/Badge';

export default function ProgressSummary({ tasks }) {
  // Only the user's own tasks count - admin-managed fixed tasks (is_global)
  // that haven't been added to "My Tasks" would otherwise inflate the total
  // with things they never chose to track.
  const myTasks = tasks.filter(t => !t.is_global);
  const total = myTasks.length;
  const completed = myTasks.filter(t => t.status === 'completed').length;
  const partiallyCompleted = myTasks.filter(t => t.status === 'partially_completed').length;
  const pct = total === 0 ? 0 : (completed / total) * 100;
  const partialPct = total === 0 ? 0 : (partiallyCompleted / total) * 100;
  const allDone = completed === total && total > 0;

  return (
    <section aria-label="Today's progress" className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-xs font-medium text-muted">Daily progress</p>
          <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-fg">
            {completed}
            <span className="text-base font-medium text-muted"> / {total} done</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {allDone ? (
            <Badge tone="success" icon={CheckCircle2}>All done</Badge>
          ) : (
            <span className="text-sm font-semibold tabular-nums text-fg-2">{Math.round(pct)}%</span>
          )}
        </div>
      </div>

      <div
        className="mt-4 flex h-2 overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-label="Tasks completed today"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
      >
        <m.div
          className="h-full bg-primary shadow-[inset_0_-1px_0_var(--edge-bottom)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 110, damping: 22 }}
        />
        {partiallyCompleted > 0 && (
          <m.div
            className="h-full bg-warning/55"
            initial={false}
            animate={{ width: `${partialPct}%` }}
            transition={{ type: 'spring', stiffness: 110, damping: 22 }}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary ring-1 ring-primary-ink/40" aria-hidden="true" /> {completed} completed
        </span>
        {partiallyCompleted > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" /> {partiallyCompleted} partial
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-border-strong" aria-hidden="true" /> {total - completed - partiallyCompleted} to go
        </span>
      </div>
    </section>
  );
}
