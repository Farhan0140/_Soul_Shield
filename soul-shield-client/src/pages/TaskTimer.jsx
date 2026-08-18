import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { ArrowLeft, Pause, Play } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { fmtDate } from '../hooks/useTasks';
import { useTimerTask } from '../hooks/useTimerTask';
import TimerRing from '../components/TimerRing';
import RewardModal from '../components/RewardModal';
import SkeletonCard from '../components/SkeletonCard';

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Dedicated Timer Task page — reached via the "Start timer" link on
 * TaskCard/SubTaskList (mirrors the mobile app's dedicated countdown
 * screen). This outer component just resolves the task/sub-task from the
 * day's already-loaded task list; the actual countdown lives in
 * TaskTimerContent below, mounted with `key={runId}` so navigating between
 * different task/sub-task/date timers (while React Router keeps this page
 * component itself mounted) always starts the countdown hook fresh instead
 * of needing it to react to prop changes after mount. */
export default function TaskTimer() {
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const subTaskIdParam = searchParams.get('subTaskId');
  const dateParam = searchParams.get('date');
  const navigate = useNavigate();
  const { getTasks } = useApi();

  const numericTaskId = Number(taskId);
  const isSubTask = !!subTaskIdParam;
  const subTaskId = isSubTask ? Number(subTaskIdParam) : null;
  const date = dateParam || fmtDate(new Date());

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reward, setReward] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTasks(date)
      .then((data) => {
        if (!cancelled) setTasks(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, getTasks]);

  const task = useMemo(() => tasks.find((t) => t.task_id === numericTaskId), [tasks, numericTaskId]);
  const subTask = useMemo(
    () => (isSubTask ? task?.sub_tasks?.find((s) => s.sub_task_id === subTaskId) : undefined),
    [task, isSubTask, subTaskId]
  );

  const title = isSubTask ? subTask?.title : task?.title;
  const description = isSubTask ? null : task?.description;
  const durationSeconds = (isSubTask ? subTask?.duration_seconds : task?.duration_seconds) || 0;
  const status = isSubTask ? subTask?.status : task?.status;
  const isCompleted = status === 'completed';
  const isMissed = isSubTask ? task?.status === 'missed' : status === 'missed';

  const isTimerType = isSubTask
    ? subTask?.task_type === 'timer'
    : task?.task_type === 'timer' && (task?.sub_tasks || []).length === 0;

  const notFound = !loading && !error && (!task || (isSubTask && !subTask));
  const invalidType = !loading && !error && !notFound && !isTimerType;

  const runId = `${numericTaskId}-${subTaskId ?? 'main'}-${date}`;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Timer</span>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : error ? (
        <div className="p-6 rounded-2xl bg-danger/10 border border-danger/30 text-center text-sm text-danger">
          {error}
        </div>
      ) : notFound ? (
        <div className="p-6 rounded-2xl bg-surface border border-border text-center text-sm text-muted">
          This task could not be found.
        </div>
      ) : invalidType ? (
        <div className="p-6 rounded-2xl bg-surface border border-border text-center text-sm text-muted">
          This task doesn&apos;t have a dedicated timer page.
        </div>
      ) : (
        <TaskTimerContent
          key={runId}
          taskId={numericTaskId}
          subTaskId={subTaskId}
          date={date}
          isSubTask={isSubTask}
          durationSeconds={durationSeconds}
          title={title}
          description={description}
          isCompleted={isCompleted}
          isMissed={isMissed}
          onRewardEarned={(text) => setReward({ text, taskTitle: title })}
        />
      )}

      <RewardModal open={!!reward} text={reward?.text} taskTitle={reward?.taskTitle} onClose={() => setReward(null)} />
    </div>
  );
}

function TaskTimerContent({
  taskId,
  subTaskId,
  date,
  isSubTask,
  durationSeconds,
  title,
  description,
  isCompleted,
  isMissed,
  onRewardEarned,
}) {
  const timer = useTimerTask({ taskId, subTaskId, date, durationSeconds, isSubTask, onRewardEarned });

  const isRunning = timer.status === 'running';
  const isIdle = timer.status === 'idle';
  const disabled = isCompleted || isMissed || timer.status === 'completed';

  const handlePress = () => {
    if (disabled) return;
    if (isIdle) timer.start();
    else if (isRunning) timer.pause();
    else timer.resume();
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center">
        <h2 className="text-lg font-bold text-fg">{title}</h2>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>

      <TimerRing progress={timer.progress} size={240} strokeWidth={16}>
        <span className="text-3xl font-bold text-fg tabular-nums">{formatRemaining(timer.remainingMs)}</span>
        <span className="text-xs text-muted mt-1">remaining</span>
      </TimerRing>

      {isCompleted && (
        <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold uppercase">
          Completed
        </span>
      )}
      {isMissed && (
        <span className="px-3 py-1 rounded-full bg-danger/10 text-danger text-xs font-semibold uppercase">
          Missed
        </span>
      )}

      <m.button
        whileTap={{ scale: disabled ? 1 : 0.92 }}
        onClick={handlePress}
        disabled={disabled}
        aria-label={isIdle ? 'Start timer' : isRunning ? 'Pause timer' : 'Resume timer'}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-shadow"
      >
        {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
      </m.button>
      <span className="text-xs text-muted">
        {disabled ? 'Timer complete' : isIdle ? 'Start timer' : isRunning ? 'Pause timer' : 'Resume timer'}
      </span>
    </div>
  );
}
