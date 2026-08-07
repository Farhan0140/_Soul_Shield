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

/** Extra fields that don't fit in the card's collapsed header, shown inline
 * (not as a modal) directly below it when the title/description is clicked —
 * recurrence, task type, reminder time, and an upcoming-reward preview for
 * tasks not yet completed (the amber reward banner elsewhere already covers
 * the completed case). */
export default function TaskDetailsInline({ task }) {
  const isCounter = task.task_type === 'counter';
  const isCompleted = task.status === 'completed';

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Repeat className="w-3.5 h-3.5 text-muted flex-shrink-0" />
        <span>{recurrenceLabel(task)}</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted">
        <Hash className="w-3.5 h-3.5 text-muted flex-shrink-0" />
        <span>{isCounter ? `Counter task — target ${task.target_count}` : 'Normal task'}</span>
      </div>

      {task.reminder_time && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Bell className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          <span>Reminder at {task.reminder_time}</span>
        </div>
      )}

      {!isCompleted && task.reward_text && (
        <div className="flex items-center gap-2 text-xs text-success">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{task.reward_text}</span>
        </div>
      )}
    </div>
  );
}
