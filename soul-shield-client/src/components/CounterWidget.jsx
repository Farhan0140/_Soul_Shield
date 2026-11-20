import { m, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import { useCounter } from '../hooks/useCounter';
import Button from './ui/Button';

export default function CounterWidget({ task, date, onUpdate, onRewardEarned, disabled = false }) {
  const { localProgress, increment } = useCounter(
    task.task_id,
    task.progress_count,
    task.target_count,
    date,
    onUpdate,
    onRewardEarned
  );

  const pct = Math.min(100, (localProgress / task.target_count) * 100);
  const done = localProgress >= task.target_count;
  const locked = done || task.status === 'completed' || disabled;

  return (
    <div className="mt-4 space-y-3">
      {/* Progress */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted">Progress</span>
          <span className="text-[13px] font-semibold tabular-nums text-fg">
            {localProgress}
            <span className="font-normal text-muted"> / {task.target_count}</span>
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-label={`${task.title} progress`}
          aria-valuemin={0}
          aria-valuemax={task.target_count}
          aria-valuenow={localProgress}
        >
          <m.div
            className="h-full rounded-full bg-primary shadow-[inset_0_-1px_0_var(--edge-bottom)]"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 24 }}
          />
        </div>
      </div>

      {/* Taps are batched locally and synced by useCounter, so these stay
          responsive instead of waiting on a request per tap. */}
      <div className="flex items-center gap-2">
        <Button onClick={() => increment(1)} disabled={locked} className="flex-1">
          <Plus className="h-4 w-4" /> Tap
        </Button>
        <Button variant="secondary" onClick={() => increment(10)} disabled={locked} className="tabular-nums">
          +10
        </Button>
        <Button variant="secondary" onClick={() => increment(33)} disabled={locked} className="tabular-nums">
          +33
        </Button>
      </div>

      {/* Target reached */}
      <AnimatePresence>
        {done && (
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-lg border border-primary-ink/15 bg-primary-soft px-3 py-2"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
            <span className="text-[13px] font-medium text-fg">{task.reward_text || 'Target reached! ✨'}</span>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
