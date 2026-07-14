import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Zap } from 'lucide-react';
import { useCounter } from '../hooks/useCounter';

export default function CounterWidget({ task, date, onUpdate }) {
  const { localProgress, increment } = useCounter(
    task.task_id,
    task.progress_count,
    task.target_count,
    date,
    onUpdate
  );

  const pct = Math.min(100, (localProgress / task.target_count) * 100);
  const done = localProgress >= task.target_count;

  return (
    <div className="mt-3 space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-600 tabular-nums min-w-[60px] text-right">
          {localProgress} / {task.target_count}
        </span>
      </div>

      {/* Tap buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => increment(1)}
          disabled={done || task.status === 'completed'}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm
            hover:shadow-lg hover:shadow-indigo-200 transition-shadow disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" /> Tap
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => increment(10)}
          disabled={done || task.status === 'completed'}
          className="px-3 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 font-semibold text-sm
            hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +10
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => increment(33)}
          disabled={done || task.status === 'completed'}
          className="px-3 py-2.5 rounded-xl bg-purple-50 text-purple-700 font-semibold text-sm
            hover:bg-purple-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +33
        </motion.button>
      </div>

      {/* Celebration when target reached */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
            >
              <Zap className="w-4 h-4 text-amber-500" fill="currentColor" />
            </motion.div>
            <span className="text-sm font-medium text-amber-800">
              {task.reward_text || 'Target reached! ✨'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}