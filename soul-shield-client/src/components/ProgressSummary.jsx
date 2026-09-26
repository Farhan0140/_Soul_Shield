import { m } from 'framer-motion';
import { Target, CheckCircle2 } from 'lucide-react';

// Diagonal stripe fill for the "partially completed" section of the bar -
// the same warning tone TaskCard already uses for a partially_completed
// task, with a translucent white diagonal overlay so it reads as "in
// progress" rather than a second solid color competing with the completed
// section's fill.
const STRIPE_BACKGROUND = {
  backgroundColor: 'var(--color-warning, #C08A2E)',
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0, rgba(255,255,255,0.35) 4px, transparent 4px, transparent 8px)',
};

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

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50">
        <Target className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1.5">
          <p className="text-sm font-medium text-fg">
            <span className="text-lg font-bold text-fg">{completed}</span>
            <span className="text-muted"> / {total} completed</span>
            {partiallyCompleted > 0 && (
              <span className="text-muted text-xs"> &middot; {partiallyCompleted} partial</span>
            )}
          </p>
          {completed === total && total > 0 && (
            <m.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-xs font-semibold text-success"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> All done!
            </m.span>
          )}
        </div>
        <div className="h-2 bg-bg rounded-full overflow-hidden flex">
          <m.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
          {partiallyCompleted > 0 && (
            <m.div
              className="h-full"
              style={STRIPE_BACKGROUND}
              animate={{ width: `${partialPct}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}