import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { ArrowLeft, Check, Pause, Play, SearchX, TimerOff } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { fmtDate } from '../hooks/useTasks';
import { useTimerTask } from '../hooks/useTimerTask';
import ExpandableText from '../components/ExpandableText';
import TimerRing from '../components/TimerRing';
import RewardModal from '../components/RewardModal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Skeleton, SkeletonGroup } from '../components/ui/Skeleton';
import { cn } from '../utils/cn';

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this effect starts
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
  const description = (isSubTask ? subTask?.description : task?.description) || null;
  const parentTitle = isSubTask ? task?.title : null;
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
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Badge tone="neutral">Focus timer</Badge>
      </div>

      {loading ? (
        <SkeletonGroup label="Loading timer…" className="card flex flex-col items-center gap-6 px-6 py-10">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-[220px] w-[220px] rounded-full" />
          <Skeleton className="h-14 w-14 rounded-2xl" />
        </SkeletonGroup>
      ) : error ? (
        <ErrorState title="Couldn't load this timer" message={error} />
      ) : notFound ? (
        <EmptyState icon={SearchX} title="Task not found" description="This task could not be found" />
      ) : invalidType ? (
        <EmptyState icon={TimerOff} title="No timer for this task" description="This task doesn't have a dedicated timer page." />
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
          parentTitle={parentTitle}
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
  parentTitle,
  isCompleted,
  isMissed,
  onRewardEarned,
}) {
  const timer = useTimerTask({ taskId, subTaskId, date, durationSeconds, isSubTask, onRewardEarned });

  const isRunning = timer.status === 'running';
  const isIdle = timer.status === 'idle';
  const isTimerCompleted = isCompleted || timer.status === 'completed';
  const disabled = isTimerCompleted || isMissed;

  const handlePress = () => {
    if (disabled) return;
    if (isIdle) timer.start();
    else if (isRunning) timer.pause();
    else timer.resume();
  };

  const stateLabel = disabled ? 'Timer complete' : isIdle ? 'Ready' : isRunning ? 'Running' : 'Paused';

  return (
    <section className="card flex flex-col items-center gap-7 px-5 py-8 sm:px-8 sm:py-10">
      {/* Details-page hierarchy (mirrors the mobile dedicated pages): parent
          task's title on top, current task's title in the SAME size/weight,
          description in a smaller font directly below the current title.
          Long entries collapse to a few lines and expand on tap (sub-task
          descriptions come from the sub-task itself since the description
          feature). */}
      <div className="w-full text-center">
        {parentTitle && (
          <ExpandableText
            as="h2"
            text={parentTitle}
            maxLines={2}
            className="text-lg font-medium leading-snug text-fg"
          />
        )}
        <ExpandableText
          as="h2"
          text={title}
          maxLines={2}
          className="text-lg font-medium leading-snug text-fg"
        />
        {description && (
          <ExpandableText
            text={description}
            maxLines={3}
            className="mt-1 text-sm text-muted"
          />
        )}
      </div>

      <TimerRing progress={timer.progress} size={232} strokeWidth={12}>
        <span className="text-[40px] font-medium leading-none tracking-tight tabular-nums text-fg" aria-live="off">
          {formatRemaining(timer.remainingMs)}
        </span>
        <span className="mt-2 text-[13px] text-muted">{stateLabel}</span>
      </TimerRing>

      {isCompleted && <Badge tone="success" dot>Completed</Badge>}
      {isMissed && <Badge tone="danger" dot>Missed</Badge>}

      <div className="flex flex-col items-center gap-2">
        <m.button
          type="button"
          whileTap={{ scale: disabled ? 1 : 0.94 }}
          onClick={handlePress}
          disabled={disabled}
          aria-label={isIdle ? 'Start timer' : isRunning ? 'Pause timer' : 'Resume timer'}
          className={cn('btn h-16 w-16 rounded-2xl', isRunning ? 'btn-secondary' : 'btn-primary')}
        >
          {isRunning ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
        </m.button>
        <span className="text-xs font-medium text-muted">
          {disabled ? 'Timer complete' : isIdle ? 'Start timer' : isRunning ? 'Pause timer' : 'Resume timer'}
        </span>
      </div>

      {!isTimerCompleted && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (isMissed) return;
            timer.complete();
          }}
          disabled={isMissed}
          aria-label="Complete task now"
          className="text-success hover:!bg-success/10 hover:!text-success"
        >
          <Check className="h-4 w-4" /> Mark as complete now
        </Button>
      )}
    </section>
  );
}
