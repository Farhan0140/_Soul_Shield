import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowUpRight, Timer } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import ExpandableText from './ExpandableText';
import TaskCheck from './TaskCheck';
import Pagination from './ui/Pagination';
import { cn } from '../utils/cn';
import { fmtDate } from '../hooks/useTasks';

const QUICK_AMOUNTS = [1, 10];
/** Max incomplete sub-tasks shown per page (matches the mobile app's
 * SubTaskList — see PROJECT_CONTEXT.md's sub-task presentation section). */
const SUB_TASKS_PER_PAGE = 2;

export default function SubTaskList({ task, date, onUpdate, onRewardEarned, disabled = false }) {
  const { completeSubTask, uncompleteSubTask, incrementSubTask } = useApi();
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
      // The checkbox toggles: a completed sub-task is marked not done again.
      const res = subTask.status === 'completed'
        ? await uncompleteSubTask(task.task_id, subTask.sub_task_id, fmtDate(date))
        : await completeSubTask(task.task_id, subTask.sub_task_id, fmtDate(date));
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
        className={cn(
          'flex items-start gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5 transition-colors',
          isTimer && 'cursor-pointer hover:border-border-strong'
        )}
      >
        {!isCounter && !isTimer && (
          <TaskCheck
            size="sm"
            checked={isCompleted}
            pending={isPending}
            disabled={disabled}
            onClick={() => handleComplete(s)}
            label={isCompleted ? `Mark "${s.title}" as not done` : `Mark "${s.title}" as done`}
          />
        )}
        {isTimer && <Timer className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {/* Truncated titles expand on tap; short titles pass clicks through
                (the timer row above keeps routing). */}
            <ExpandableText
              as="p"
              text={s.title}
              maxLines={2}
              className={cn('min-w-0 flex-1 text-[13px] font-medium', isCompleted ? 'text-muted line-through' : 'text-fg')}
            />
            {isTimer && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenTimer(s.sub_task_id);
                }}
                aria-label={`Open timer for "${s.title}"`}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-fg"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {s.description && (
            <ExpandableText
              as="p"
              text={s.description}
              maxLines={2}
              className={cn('mt-0.5 text-xs leading-4 text-muted', isCompleted && 'line-through')}
            />
          )}

          {isCounter && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-medium tabular-nums text-muted">
                  {s.progress_count || 0}/{s.target_count}
                </span>
              </div>
              <div className="flex gap-1.5">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleIncrement(s, amount)}
                    disabled={isDisabled || isCompleted}
                    aria-busy={isPending || undefined}
                    className="btn btn-secondary h-7 rounded-md px-2.5 text-xs tabular-nums"
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
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted">
        Sub-tasks
        <span className="ml-1.5 tabular-nums text-subtle">
          {completedSubTasks.length}/{task.sub_tasks.length} done
        </span>
      </p>

      {pageRows.map(renderRow)}

      {totalPages > 1 && (
        <Pagination
          compact
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          label="Sub-task pages"
          className="pt-0.5"
        />
      )}

      {completedSubTasks.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setCompletedExpanded((v) => !v)}
            aria-expanded={completedExpanded}
            className="inline-flex h-7 items-center gap-1 rounded-md px-1 text-xs font-semibold text-success transition-colors hover:bg-success/10"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', completedExpanded ? 'rotate-180' : '')} />
            Completed sub-tasks ({completedSubTasks.length})
          </button>

          {completedExpanded && completedSubTasks.map(renderRow)}
        </div>
      )}
    </div>
  );
}
