import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Edit2, Trash2, Shield, Sparkles, Loader2 } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../hooks/useTasks';
import CounterWidget from './CounterWidget';
import SubTaskList from './SubTaskList';
import RewardModal from './RewardModal';
import TaskDetailsInline from './TaskDetailsInline';

export default function TaskCard({ task, date, onEdit, onDelete, onUpdate, isReadOnly = false }) {
  const { user } = useAuth();
  const { completeTask, deleteTask } = useApi();
  const toast = useToast();
  const [completing, setCompleting] = useState(false);
  const [rewardText, setRewardText] = useState(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const isCounter = task.task_type === 'counter';
  const isCompleted = task.status === 'completed';
  const isMissed = task.status === 'missed';
  const isPartiallyCompleted = task.status === 'partially_completed';
  const hasSubTasks = (task.sub_tasks || []).length > 0;
  const categoryColor = task.category_color || '#94a3b8';

  // Who can edit/delete?
  const canManage = !isReadOnly && (
    task.is_global ? user?.role === 'admin' : true
  );

  const handleToggleComplete = async () => {
    if (isCounter || hasSubTasks || isCompleted || isMissed) return;
    setCompleting(true);
    try {
      const res = await completeTask(task.task_id, fmtDate(date));
      onUpdate({ ...res, status: 'completed', reward_text: res.reward_text });
      if (res.reward_text) setRewardText(res.reward_text);
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
      className={`relative rounded-2xl border-2 bg-surface p-4 transition-all overflow-hidden
        ${isCompleted ? 'border-success/30 bg-success/10' : ''}
        ${isPartiallyCompleted ? 'border-warning/30 bg-warning/10' : ''}
        ${isMissed ? 'border-danger/30 bg-danger/10 opacity-80' : ''}
        ${!isCompleted && !isPartiallyCompleted && !isMissed ? 'border-border hover:border-border hover:shadow-md' : ''}
      `}
      style={{ borderLeftWidth: '4px', borderLeftColor: categoryColor }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Checkbox (normal tasks only, and only when there are no sub-tasks —
            a sub-tasked parent's completion is derived, not directly toggled) */}
        {!isCounter && !hasSubTasks && (
          <m.button
            whileTap={{ scale: 0.85 }}
            onClick={handleToggleComplete}
            disabled={isCompleted || isMissed || completing || isReadOnly}
            className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
              ${isCompleted ? 'bg-success border-success' : 'border-border hover:border-primary'}
              disabled:cursor-not-allowed`}
          >
            {completing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : isCompleted ? (
              <Check className="w-4 h-4 text-white" strokeWidth={3} />
            ) : null}
          </m.button>
        )}

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          {/* Only the title/description block expands the inline details
              section below — checkbox, counter, and sub-task controls
              above/below live outside this wrapper so tapping them never
              triggers it. */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDetailsExpanded((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDetailsExpanded((v) => !v);
              }
            }}
            className="cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-semibold text-fg leading-snug ${isCompleted ? 'line-through text-muted' : ''}`}>
                {task.title}
              </h3>
              <div className="flex items-center gap-1 flex-shrink-0">
                {task.is_global && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-semibold uppercase tracking-wide">
                    <Shield className="w-3 h-3" /> Fixed
                  </span>
                )}
                {isPartiallyCompleted && !isReadOnly && (
                  <span className="text-[10px] font-semibold text-warning uppercase">Partially Completed</span>
                )}
                {isMissed && !isReadOnly && (
                  <span className="text-[10px] font-semibold text-danger uppercase">Missed</span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-muted transition-transform ${detailsExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            {task.description && (
              <p className="text-sm text-muted mt-0.5 line-clamp-2">{task.description}</p>
            )}

            {detailsExpanded && <TaskDetailsInline task={task} />}
          </div>

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
      {isCounter && !hasSubTasks && (
        <CounterWidget
          task={task}
          date={date}
          onUpdate={handleCounterUpdate}
          onRewardEarned={setRewardText}
          disabled={isReadOnly}
        />
      )}

      {/* Sub-tasks */}
      {hasSubTasks && (
        <SubTaskList
          task={task}
          date={date}
          onUpdate={onUpdate}
          onRewardEarned={setRewardText}
          disabled={isReadOnly}
        />
      )}

      {/* Reward text (completed normal/sub-tasked tasks; counter tasks show their own via CounterWidget) */}
      <AnimatePresence>
        {isCompleted && !isCounter && task.reward_text && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-warning/30"
          >
            <m.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
            >
              <Sparkles className="w-4 h-4 text-warning" fill="currentColor" />
            </m.div>
            <span className="text-sm font-medium text-warning">{task.reward_text}</span>
          </m.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {canManage && (
        <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border">
          <m.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onEdit(task)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-bg transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </m.button>
          <m.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDelete}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </m.button>
        </div>
      )}

      <RewardModal
        open={!!rewardText}
        text={rewardText}
        taskTitle={task.title}
        onClose={() => setRewardText(null)}
      />
    </m.div>
  );
}