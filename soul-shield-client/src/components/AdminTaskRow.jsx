import { m } from 'framer-motion';
import { Pencil, Trash2, Shield, Calendar, Repeat, Hash } from 'lucide-react';
import { cn } from '../utils/cn';
import UsageBadge from './UsageBadge';
import Checkbox from './ui/Checkbox';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';

const RECURRENCE_LABELS = {
  daily: 'Every day',
  weekly: 'Weekly',
  custom: 'Custom',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminTaskRow({ task, usage, selected, onSelect, onEdit, onDelete }) {
  const categoryColor = task.category_color || '#94a3b8';
  const recurrenceLabel = RECURRENCE_LABELS[task.recurrence_type] || task.recurrence_type;

  // Build day pills for weekly/custom
  const dayPills = task.recurrence_type !== 'daily' && task.recurrence_days
    ? task.recurrence_days.map(d => DAY_NAMES[d]).join(', ')
    : null;

  return (
    <m.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'card p-4 transition-[border-color,background-color] sm:p-5',
        selected && '!border-primary-ink/40 bg-primary-soft/60'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Selection checkbox */}
        <Checkbox
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Select "${task.title}"`}
          className="mt-0.5"
        />

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold leading-snug text-fg">{task.title}</h3>
              {task.description && (
                <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{task.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-0.5">
              <Tooltip label="Edit">
                <Button variant="ghost" size="sm" iconOnly onClick={() => onEdit(task)} aria-label={`Edit "${task.title}"`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip label="Delete" align="end">
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => onDelete(task)}
                  aria-label={`Delete "${task.title}"`}
                  className="hover:!bg-danger/10 hover:!text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="warning" icon={Shield}>Fixed</Badge>
            {task.task_type === 'counter' && (
              <Badge tone="neutral" icon={Hash}>Counter · {task.target_count}</Badge>
            )}
            {task.category_name && <Badge color={categoryColor}>{task.category_name}</Badge>}
            <span className="inline-flex items-center gap-1 px-1 text-xs text-muted">
              <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
              {recurrenceLabel}
            </span>
            {dayPills && (
              <span className="inline-flex items-center gap-1 px-1 text-xs text-muted">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                {dayPills}
              </span>
            )}
          </div>

          {/* Usage stats */}
          {usage && (
            <div className="mt-3.5">
              <UsageBadge usage={usage} />
            </div>
          )}
        </div>
      </div>
    </m.div>
  );
}
