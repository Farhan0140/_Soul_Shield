import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, ArrowUpRight } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import ExpandableText from './ExpandableText';
import { fmtDate } from '../hooks/useTasks';

const QUICK_AMOUNTS = [1, 10];
/** Max incomplete sub-tasks shown per page (matches the mobile app's
 * SubTaskList — see PROJECT_CONTEXT.md's sub-task presentation section). */
const SUB_TASKS_PER_PAGE = 2;

export default function SubTaskList({ task, date, onUpdate, onRewardEarned, disabled = false }) {
  const { completeSubTask, incrementSubTask } = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const [pendingId, setPendingId] = useState(null);
  const [page, setPage] = useState(1);
  // Collapsed by default — completed sub-tasks move here automatically.
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const handleOpenTimer = (subTaskId) => {
    navigate(`/tasks/${task.task_id}/timer?subTaskId=${subTaskId}&date=${fmtDate(date)}`);
  };

  const applyResult = (subTaskId, res) => {
    const nextSubTasks = task.sub_tasks.map((s) =>
      s.sub_task_id === subTaskId ? { ...s, status: res.status, progress_count: res.progress_count } : s
    );
    onUpdate({
      status: res.parent_status,
      sub_tasks: nextSubTasks,
      reward_text: res.parent_status === 'completed' ? res.parent_reward_text : undefined,
    });
    if (res.parent_status === 'completed' && res.parent_reward_text) {
      onRewardEarned?.(res.parent_reward_text);
    }
  };

  const handleComplete = async (subTask) => {
    setPendingId(subTask.sub_task_id);
    try {
      const res = await completeSubTask(task.task_id, subTask.sub_task_id, fmtDate(date));
      applyResult(subTask.sub_task_id, res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPendingId(null);
    }
  };

  const handleIncrement = async (subTask, amount) => {
    setPendingId(subTask.sub_task_id);
    try {
      const res = await incrementSubTask(task.task_id, subTask.sub_task_id, fmtDate(date), amount);
      applyResult(subTask.sub_task_id, res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPendingId(null);
    }
  };

  const renderRow = (s) => {
    const isCompleted = s.status === 'completed';
    const isCounter = s.task_type === 'counter';
    const isTimer = s.task_type === 'timer';
    const isPending = pendingId === s.sub_task_id;
    const isDisabled = disabled || isPending;
    const pct = isCounter ? Math.min(100, ((s.progress_count || 0) / (s.target_count || 1)) * 100) : 0;

    return (
      <div
        key={s.sub_task_id}
        onClick={isTimer ? () => handleOpenTimer(s.sub_task_id) : undefined}
        className={`flex items-start gap-2 rounded-xl border border-border bg-bg p-2.5 ${isTimer ? 'cursor-pointer' : ''}`}
      >
        {!isCounter && !isTimer && (
          <button
            type="button"
            onClick={() => handleComplete(s)}
            disabled={isDisabled}
            aria-label={isCompleted ? `Mark "${s.title}" as not done` : `Mark "${s.title}" as done`}
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
              ${isCompleted ? 'bg-success border-success' : 'border-border hover:border-primary'}
              disabled:cursor-not-allowed`}
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
            ) : isCompleted ? (
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            ) : null}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* Truncated titles expand on tap; short titles pass clicks through
                (the timer row above keeps routing). */}
            <ExpandableText
              as="p"
              text={s.title}
              maxLines={2}
              className={`flex-1 min-w-0 text-sm ${isCompleted ? 'line-through text-muted' : 'text-fg'}`}
            />
            {isTimer && (
              <button
                type="button"
                onClick={() => handleOpenTimer(s.sub_task_id)}
                aria-label="Open timer"
                className="text-primary hover:text-indigo-700 transition-colors"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {s.description && (
            <ExpandableText
              as="p"
              text={s.description}
              maxLines={2}
              className={`mt-0.5 text-xs leading-4 ${isCompleted ? 'line-through text-muted' : 'text-muted'}`}
            />
          )}

          {isCounter && (
            <div className="mt-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted tabular-nums">
                  {s.progress_count || 0}/{s.target_count}
                </span>
              </div>
              <div className="flex gap-1">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleIncrement(s, amount)}
                    disabled={isDisabled || isCompleted}
                    className="px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    +{amount}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Presentation-only split (mirrors the mobile SubTaskList): the parent's
  // derived status still comes from the server's parent_status — this only
  // decides what this section shows. Order within each list is the
  // sub_tasks array's own (position) order as returned.
  const activeSubTasks = task.sub_tasks.filter((s) => s.status !== 'completed');
  const completedSubTasks = task.sub_tasks.filter((s) => s.status === 'completed');

  const totalPages = Math.max(1, Math.ceil(activeSubTasks.length / SUB_TASKS_PER_PAGE));
  // Clamp to the last page when the active list shrinks (a sub-task got
  // completed); `page` state itself is left alone and converges as the list
  // grows back — every control below works off the clamped value.
  const currentPage = Math.min(page, totalPages);
  const pageRows = activeSubTasks.slice(
    (currentPage - 1) * SUB_TASKS_PER_PAGE,
    currentPage * SUB_TASKS_PER_PAGE
  );

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2.5">
      {pageRows.map(renderRow)}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 pt-0.5">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-indigo-700 disabled:text-muted disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>
          <span className="text-xs font-semibold text-muted">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-indigo-700 disabled:text-muted disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {completedSubTasks.length > 0 && (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setCompletedExpanded((v) => !v)}
            aria-expanded={completedExpanded}
            className="flex items-center gap-1 text-xs font-semibold text-success hover:opacity-80 transition-opacity"
          >
            {completedExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Completed Sub-Tasks ({completedSubTasks.length})
          </button>

          {completedExpanded && completedSubTasks.map(renderRow)}
        </div>
      )}
    </div>
  );
}
