import { motion } from 'framer-motion';
import { Target, CheckCircle2 } from 'lucide-react';

export default function ProgressSummary({ tasks }) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pct = total === 0 ? 0 : (completed / total) * 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50">
        <Target className="w-6 h-6 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1.5">
          <p className="text-sm font-medium text-slate-700">
            <span className="text-lg font-bold text-slate-900">{completed}</span>
            <span className="text-slate-400"> / {total} completed</span>
          </p>
          {completed === total && total > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-600"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> All done!
            </motion.span>
          )}
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
        </div>
      </div>
    </div>
  );
}