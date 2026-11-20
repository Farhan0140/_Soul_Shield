import { Repeat, Hash, Bell, Sparkles } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function recurrenceLabel(task) {
  if (task.recurrence_type === 'daily') return 'Every day';
  const days = (task.recurrence_days || [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAYS[d])
    .join(', ');
  const label = task.recurrence_type === 'weekly' ? 'Weekly' : 'Custom days';
  return days ? `${label} — ${days}` : label;
}

/** Compact "25 min" / "1h 30m" label for a fixed duration_seconds. */
function formatDurationLabel(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes} min`;
}

function Row({ icon: Icon, children, className = 'text-muted' }) {
  return (
    <div className={`flex items-start gap-2 text-[13px] leading-snug ${className}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Extra fields that don't fit in the card's collapsed header, shown inline
 * (not as a modal) directly below it when the title/description is clicked —
 * recurrence, task type, reminder time, and an upcoming-reward preview for
 * tasks not yet completed (the reward banner elsewhere already covers the
 * completed case). */
export default function TaskDetailsInline({ task }) {
  const isCounter = task.task_type === 'counter';
  const isTimer = task.task_type === 'timer';
  const isCompleted = task.status === 'completed';

  return (
    <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <Row icon={Repeat}>{recurrenceLabel(task)}</Row>
      <Row icon={Hash}>
        {isCounter
          ? `Counter task — target ${task.target_count}`
          : isTimer
            ? `Timer task — ${formatDurationLabel(task.duration_seconds)}`
            : 'Normal task'}
      </Row>
      {task.reminder_time && <Row icon={Bell}>Reminder at {task.reminder_time}</Row>}
      {!isCompleted && task.reward_text && (
        <Row icon={Sparkles} className="text-primary-ink">
          {task.reward_text}
        </Row>
      )}
    </div>
  );
}
