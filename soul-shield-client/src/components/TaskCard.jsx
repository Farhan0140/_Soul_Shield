import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Edit2, Trash2, Shield, Sparkles, Loader2, Timer, ArrowUpRight, PlusCircle, CheckCircle2 } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../hooks/useTasks';
import CounterWidget from './CounterWidget';
import SubTaskList from './SubTaskList';
import RewardModal from './RewardModal';
import TaskDetailsInline from './TaskDetailsInline';

// variant="template" renders a fixed/admin task as a read-only template card —
// no completion controls or personal progress, just an "Add to Your Own Tasks"
// action (see CategoryDetail.jsx's 'fixed' pseudo-category).
export default function TaskCard({ task, date, onEdit, onDelete, onUpdate, isReadOnly = false, variant = 'full' }) {
  const { user } = useAuth();
  const { completeTask, deleteTask, addTaskToMyTasks } = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const [completing, setCompleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rewardText, setRewardText] = useState(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const isTemplate = variant === 'template';
  const isCounter = task.task_type === 'counter';
  const isTimer = task.task_type === 'timer';
  const isCompleted = task.status === 'completed';
  const isMissed = task.status === 'missed';
  const isPartiallyCompleted = task.status === 'partially_completed';
  const hasSubTasks = (task.sub_tasks || []).length > 0;
  const categoryColor = task.category_color || '#94a3b8';

  // Who can edit/delete?
  const canManage = !isTemplate && !isReadOnly && (
    task.is_global ? user?.role === 'admin' : true
  );

  const handleAddToMyTasks = async () => {
    setAdding(true);
    try {
      const res = await addTaskToMyTasks(task.task_id);
      onUpdate({ already_added: true });
      toast.success(res.already_added ? 'Already in your tasks.' : 'Added to your tasks!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleOpenTimer = () => {
    navigate(`/tasks/${task.task_id}/timer?date=${fmtDate(date)}`);
  };

  // Timer tasks have their own dedicated page — clicking anywhere on the
  // card (not just the small "Start timer" button) should jump straight
  // there instead of expanding the inline details that other task types use.
  const opensTimerPage = !isTemplate && isTimer && !hasSubTasks;

  const handleToggleComplete = async () => {
    if (isCounter || isTimer || hasSubTasks || isCompleted || isMissed) return;
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
      onClick={opensTimerPage ? handleOpenTimer : undefined}
      className={`relative rounded-2xl border-2 bg-surface p-4 transition-all overflow-hidden
        ${opensTimerPage ? 'cursor-pointer' : ''}
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
        {!isTemplate && !isCounter && !isTimer && !hasSubTasks && (
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
            onClick={() => (opensTimerPage ? handleOpenTimer() : setDetailsExpanded((v) => !v))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                opensTimerPage ? handleOpenTimer() : setDetailsExpanded((v) => !v);
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
                {!opensTimerPage && (
                  <ChevronDown
                    className={`w-4 h-4 text-muted transition-transform ${detailsExpanded ? 'rotate-180' : ''}`}
                  />
                )}
              </div>
            </div>

            {task.description && (
              <p className="text-sm text-muted mt-0.5 line-clamp-2">{task.description}</p>
            )}

            {!opensTimerPage && detailsExpanded && <TaskDetailsInline task={task} />}
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
      {!isTemplate && isCounter && !hasSubTasks && (
        <CounterWidget
          task={task}
          date={date}
          onUpdate={handleCounterUpdate}
          onRewardEarned={setRewardText}
          disabled={isReadOnly}
        />
      )}

      {/* Timer task — always opens the dedicated countdown page, never inline */}
      {!isTemplate && isTimer && !hasSubTasks && (
        <m.button
          whileTap={{ scale: 0.97 }}
          onClick={handleOpenTimer}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-indigo-200 transition-shadow"
        >
          <Timer className="w-4 h-4" />
          {isCompleted ? 'View timer' : 'Start timer'}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </m.button>
      )}

      {/* Sub-tasks */}
      {!isTemplate && hasSubTasks && (
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
        {!isTemplate && isCompleted && !isCounter && task.reward_text && (
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

      {/* Add-to-your-tasks action (template/fixed tasks only) */}
      {isTemplate && (
        <div className="mt-3 pt-3 border-t border-border">
          {task.already_added ? (
            <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-success/10 text-success font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" /> Already Added
            </div>
          ) : (
            <m.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAddToMyTasks}
              disabled={adding}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-indigo-200 transition-shadow disabled:opacity-60"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Add to Your Own Tasks
            </m.button>
          )}
        </div>
      )}

      {/* Action buttons */}
      {canManage && (
        <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border">
          <m.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-bg transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </m.button>
          <m.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
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