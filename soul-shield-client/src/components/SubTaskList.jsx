import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import { fmtDate } from '../hooks/useTasks';

const QUICK_AMOUNTS = [1, 10];

export default function SubTaskList({ task, date, onUpdate, onRewardEarned, disabled = false }) {
  const { completeSubTask, incrementSubTask } = useApi();
  const toast = useToast();
  const [pendingId, setPendingId] = useState(null);

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

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2.5">
      {task.sub_tasks.map((s) => {
        const isCompleted = s.status === 'completed';
        const isCounter = s.task_type === 'counter';
        const isPending = pendingId === s.sub_task_id;
        const isDisabled = disabled || isPending;
        const pct = isCounter ? Math.min(100, ((s.progress_count || 0) / (s.target_count || 1)) * 100) : 0;

        return (
          <div key={s.sub_task_id} className="flex items-start gap-2">
            {!isCounter && (
              <button
                type="button"
                onClick={() => handleComplete(s)}
                disabled={isDisabled}
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
              <p className={`text-sm ${isCompleted ? 'line-through text-muted' : 'text-fg'}`}>
                {s.title}
              </p>

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
      })}
    </div>
  );
}
