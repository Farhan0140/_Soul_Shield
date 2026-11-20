import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronDown, Pencil, Trash2, Shield, Sparkles, Timer, ArrowUpRight, PlusCircle, CheckCircle2 } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import ExpandableText from './ExpandableText';
import { fmtDate } from '../hooks/useTasks';
import CounterWidget from './CounterWidget';
import SubTaskList from './SubTaskList';
import RewardModal from './RewardModal';
import ConfirmModal from './ConfirmModal';
import TaskDetailsInline from './TaskDetailsInline';
import TaskCheck from './TaskCheck';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';

const STATUS_BADGE = {
  completed: { tone: 'success', label: 'Completed' },
  partially_completed: { tone: 'warning', label: 'Partially completed' },
  missed: { tone: 'danger', label: 'Missed' },
};

// variant="template" renders a fixed/admin task as a read-only template card —
// no completion controls or personal progress, just an "Add to Your Own Tasks"
// action (see CategoryDetail.jsx's 'fixed' pseudo-category).
export default function TaskCard({ task, date, onEdit, onDelete, onUpdate, isReadOnly = false, variant = 'full' }) {
  const { user } = useAuth();
  const { completeTask, uncompleteTask, deleteTask, addTaskToMyTasks } = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const [completing, setCompleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rewardText, setRewardText] = useState(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  // Template cards (the "Fixed Tasks" pseudo-category) are otherwise
  // read-only — but an admin still needs a way to delete the fixed task
  // itself from here, not just from the dedicated Admin Panel.
  const canDeleteTemplate = isTemplate && !isReadOnly && task.is_global && user?.role === 'admin';

  const handleAddToMyTasks = async () => {
    setAdding(true);
    try {
      const res = await addTaskToMyTasks(task.task_id);
      onUpdate({ already_added: true });
      toast.success(res.already_added ? 'Already in your tasks.' : 'Added to your tasks');
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
    if (isCounter || isTimer || hasSubTasks || isMissed) return;
    setCompleting(true);
    try {
      if (isCompleted) {
        // Tapped by mistake: undo it.
        const res = await uncompleteTask(task.task_id, fmtDate(date));
        onUpdate({ ...res, status: 'pending' });
        return;
      }
      const res = await completeTask(task.task_id, fmtDate(date));
      onUpdate({ ...res, status: 'completed', reward_text: res.reward_text });
      if (res.reward_text) setRewardText(res.reward_text);
      toast.success('Task completed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCompleting(false);
    }
  };

  // Runs once the user confirms in the dialog (replaces window.confirm).
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTask(task.task_id);
      setConfirmDeleteOpen(false);
      onDelete(task.task_id);
      toast.success('Task deleted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const requestDelete = (e) => {
    e.stopPropagation();
    setConfirmDeleteOpen(true);
  };

  const handleCounterUpdate = (patch) => {
    onUpdate(patch);
  };

  const toggleDetails = () => (opensTimerPage ? handleOpenTimer() : setDetailsExpanded((v) => !v));
  const statusBadge = STATUS_BADGE[task.status];

  return (
    <m.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onClick={opensTimerPage ? handleOpenTimer : undefined}
      className={cn(
        'card flex flex-col p-4',
        opensTimerPage && 'card-interactive cursor-pointer',
        isCompleted && !isTemplate && 'bg-surface-2',
        isPartiallyCompleted && !isTemplate && '!border-warning/35',
        isMissed && 'opacity-80'
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Checkbox (normal tasks only, and only when there are no sub-tasks —
            a sub-tasked parent's completion is derived, not directly toggled) */}
        {!isTemplate && !isCounter && !isTimer && !hasSubTasks && (
          <TaskCheck
            checked={isCompleted}
            pending={completing}
            disabled={isMissed || isReadOnly}
            onClick={handleToggleComplete}
            label={isCompleted ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          />
        )}
        {!isTemplate && isTimer && !hasSubTasks && (
          <span className="icon-tile mt-px h-[22px] w-[22px] rounded-md text-primary-ink" aria-hidden="true">
            <Timer className="h-3.5 w-3.5" />
          </span>
        )}

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          {/* Only the title/description block expands the inline details
              section below — checkbox, counter, and sub-task controls
              above/below live outside this wrapper so tapping them never
              triggers it. */}
          <div
            role="button"
            tabIndex={0}
            aria-expanded={opensTimerPage ? undefined : detailsExpanded}
            onClick={(e) => {
              e.stopPropagation();
              toggleDetails();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleDetails();
              }
            }}
            className="-m-1 cursor-pointer rounded-md p-1"
          >
            <div className="flex items-start justify-between gap-2">
              {/* ExpandableText claims the click only when the title is long
                  enough to truncate — otherwise the click falls through and
                  still toggles the inline details section below. */}
              <ExpandableText
                as="h3"
                text={task.title}
                maxLines={2}
                className={cn(
                  'min-w-0 flex-1 text-[15px] font-medium leading-snug',
                  isCompleted ? 'text-muted line-through decoration-muted/60' : 'text-fg'
                )}
              />
              <div className="flex shrink-0 items-center gap-1.5">
                {statusBadge && !isTemplate && <Badge tone={statusBadge.tone} dot>{statusBadge.label}</Badge>}
                {opensTimerPage ? (
                  <ArrowUpRight className="h-4 w-4 text-subtle" aria-hidden="true" />
                ) : (
                  <ChevronDown
                    className={cn('h-4 w-4 text-subtle transition-transform duration-200', detailsExpanded && 'rotate-180')}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>

            {task.description && (
              <ExpandableText
                text={task.description}
                maxLines={2}
                className="mt-1 text-[13px] leading-relaxed text-muted"
              />
            )}
          </div>

          {(task.category_name || task.is_global) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {task.category_name && <Badge color={categoryColor}>{task.category_name}</Badge>}
              {task.is_global && <Badge tone="warning" icon={Shield}>Fixed</Badge>}
            </div>
          )}

          <AnimatePresence initial={false}>
            {!opensTimerPage && detailsExpanded && (
              <m.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <TaskDetailsInline task={task} />
              </m.div>
            )}
          </AnimatePresence>
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
        <Button
          variant="secondary"
          fullWidth
          className="mt-4"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenTimer();
          }}
        >
          <Timer className="h-4 w-4" />
          {isCompleted ? 'View timer' : 'Start timer'}
        </Button>
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
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary-ink/15 bg-primary-soft px-3 py-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
              <span className="text-[13px] font-medium text-fg">{task.reward_text}</span>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Add-to-your-tasks action (template/fixed tasks only) */}
      {isTemplate && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
          {task.already_added ? (
            <div className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[9px] border border-success/20 bg-success/10 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" /> Already added
            </div>
          ) : (
            <Button onClick={handleAddToMyTasks} loading={adding} className="flex-1">
              <PlusCircle className="h-4 w-4" />
              Add to your tasks
            </Button>
          )}

          {canDeleteTemplate && (
            <Tooltip label="Delete fixed task" align="end">
              <Button variant="danger-soft" iconOnly onClick={requestDelete} aria-label="Delete fixed task">
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
        </div>
      )}

      {/* Action buttons */}
      {canManage && (
        <div className="mt-4 flex items-center justify-end gap-1 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={requestDelete} className="text-danger hover:!bg-danger/10 hover:!text-danger">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      )}

      <RewardModal
        open={!!rewardText}
        text={rewardText}
        taskTitle={task.title}
        onClose={() => setRewardText(null)}
      />

      <ConfirmModal
        open={confirmDeleteOpen}
        onClose={() => !deleting && setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        icon={Trash2}
        title={task.is_global ? 'Delete this fixed task?' : 'Delete this task?'}
        message={
          task.is_global
            ? `“${task.title}” will be removed from every user's dashboard. This can't be undone.`
            : `“${task.title}” will be deleted. This can't be undone.`
        }
        confirmLabel="Delete task"
        variant="danger"
      />
    </m.article>
  );
}
