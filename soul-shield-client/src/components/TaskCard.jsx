import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Check, Edit2, Trash2, Shield, Sparkles, Loader2 } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../hooks/useTasks';
import CounterWidget from './CounterWidget';

export default function TaskCard({ task, date, onEdit, onDelete, onUpdate, isReadOnly = false }) {
  const { user } = useAuth();
  const { completeTask, deleteTask } = useApi();
  const toast = useToast();
  const [completing, setCompleting] = useState(false);

  const isCounter = task.task_type === 'counter';
  const isCompleted = task.status === 'completed';
  const isMissed = task.status === 'missed';
  const categoryColor = task.category_color || '#94a3b8';

  // Who can edit/delete?
  const canManage = !isReadOnly && (
    task.is_global ? user?.role === 'admin' : true
  );

  const handleToggleComplete = async () => {
    if (isCounter || isCompleted || isMissed) return;
    setCompleting(true);
    try {
      const res = await completeTask(task.task_id, fmtDate(date));
      onUpdate({ ...res, status: 'completed', reward_text: res.reward_text });
      toast.success('Nice work! 🎉');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCompleting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
      await deleteTask(task.task_id);
      onDelete(task.task_id);
      toast.success('Task deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCounterUpdate = (patch) => {
    onUpdate(patch);
  };

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2 }}
      className={`relative rounded-2xl border-2 bg-white p-4 transition-all overflow-hidden
        ${isCompleted ? 'border-emerald-200 bg-emerald-50/30' : ''}
        ${isMissed ? 'border-rose-200 bg-rose-50/30 opacity-80' : ''}
        ${!isCompleted && !isMissed ? 'border-slate-200 hover:border-slate-300 hover:shadow-md' : ''}
      `}
      style={{ borderLeftWidth: '4px', borderLeftColor: categoryColor }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Checkbox (normal tasks only) */}
        {!isCounter && (
          <m.button
            whileTap={{ scale: 0.85 }}
            onClick={handleToggleComplete}
            disabled={isCompleted || isMissed || completing || isReadOnly}
            className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
              ${isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-indigo-500'}
              disabled:cursor-not-allowed`}
          >
            {completing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            ) : isCompleted ? (
              <Check className="w-4 h-4 text-white" strokeWidth={3} />
            ) : null}
          </m.button>
        )}

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-semibold text-slate-800 leading-snug ${isCompleted ? 'line-through text-slate-500' : ''}`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {task.is_global && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide">
                  <Shield className="w-3 h-3" /> Fixed
                </span>
              )}
              {isMissed && !isReadOnly && (
                <span className="text-[10px] font-semibold text-rose-500 uppercase">Missed</span>
              )}
            </div>
          </div>

          {task.description && (
            <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}

          {task.category_name && (
            <span
              className="inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
              style={{ backgroundColor: categoryColor }}
            >
              {task.category_name}
            </span>
          )}
        </div>
      </div>

      {/* Counter widget */}
      {isCounter && (
        <CounterWidget task={task} date={date} onUpdate={handleCounterUpdate} />
      )}

      {/* Reward text (completed normal tasks) */}
      <AnimatePresence>
        {isCompleted && !isCounter && task.reward_text && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200"
          >
            <m.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
            >
              <Sparkles className="w-4 h-4 text-amber-500" fill="currentColor" />
            </m.div>
            <span className="text-sm font-medium text-amber-800">{task.reward_text}</span>
          </m.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {canManage && (
        <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-slate-100">
          <m.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onEdit(task)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </m.button>
          <m.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDelete}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </m.button>
        </div>
      )}
    </m.div>
  );
}