import { m, AnimatePresence } from 'framer-motion';
import { Plus, Zap } from 'lucide-react';
import { useCounter } from '../hooks/useCounter';

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

  return (
    <div className="mt-3 space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2.5 bg-bg rounded-full overflow-hidden">
          <m.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="text-xs font-semibold text-muted tabular-nums min-w-[60px] text-right">
          {localProgress} / {task.target_count}
        </span>
      </div>

      {/* Tap buttons */}
      <div className="flex items-center gap-2">
        <m.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => increment(1)}
          disabled={done || task.status === 'completed' || disabled}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm
            hover:shadow-lg hover:shadow-indigo-200 transition-shadow disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" /> Tap
        </m.button>
        <m.button
          whileTap={{ scale: 0.9 }}
          onClick={() => increment(10)}
          disabled={done || task.status === 'completed' || disabled}
          className="px-3 py-2.5 rounded-xl bg-primary/10 text-primary font-semibold text-sm
            hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +10
        </m.button>
        <m.button
          whileTap={{ scale: 0.9 }}
          onClick={() => increment(33)}
          disabled={done || task.status === 'completed' || disabled}
          className="px-3 py-2.5 rounded-xl bg-purple-50 text-purple-700 font-semibold text-sm
            hover:bg-purple-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +33
        </m.button>
      </div>

      {/* Celebration when target reached */}
      <AnimatePresence>
        {done && (
          <m.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-warning/30"
          >
            <m.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
            >
              <Zap className="w-4 h-4 text-warning" fill="currentColor" />
            </m.div>
            <span className="text-sm font-medium text-warning">
              {task.reward_text || 'Target reached! ✨'}
            </span>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}