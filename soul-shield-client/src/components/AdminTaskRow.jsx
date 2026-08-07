import { m } from 'framer-motion';
import { Edit2, Trash2, Shield, Tag, Calendar, Repeat, Check, X } from 'lucide-react';
import UsageBadge from './UsageBadge';

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
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`group bg-surface rounded-2xl border-2 overflow-hidden transition-all
        ${selected ? 'border-primary/60 bg-primary/5 shadow-md' : 'border-border hover:border-border hover:shadow-sm'}
      `}
      style={{ borderLeftWidth: '4px', borderLeftColor: categoryColor }}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Selection checkbox */}
        <m.button
          whileTap={{ scale: 0.85 }}
          onClick={() => onSelect(!selected)}
          className={`mt-1 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
            ${selected ? 'bg-primary border-primary' : 'border-border hover:border-primary'}
          `}
        >
          {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </m.button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <h3 className="font-bold text-fg text-base leading-snug truncate">
                {task.title}
              </h3>
              {task.description && (
                <p className="text-sm text-muted mt-0.5 line-clamp-1">{task.description}</p>
              )}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {task.task_type === 'counter' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wide">
                  🔢 Counter · {task.target_count}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-bold uppercase tracking-wide">
                <Shield className="w-3 h-3" /> Fixed
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5" />
              {recurrenceLabel}
            </span>
            {dayPills && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {dayPills}
              </span>
            )}
            {task.category_name && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: categoryColor }}
              >
                <Tag className="w-3 h-3" />
                {task.category_name}
              </span>
            )}
          </div>

          {/* Usage stats */}
          <div className="mt-3">
            <UsageBadge usage={usage} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <m.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onEdit(task)}
            className="p-2 rounded-lg text-muted hover:bg-primary/10 hover:text-primary transition-colors"
            aria-label="Edit task"
          >
            <Edit2 className="w-4 h-4" />
          </m.button>
          <m.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(task)}
            className="p-2 rounded-lg text-muted hover:bg-danger/10 hover:text-danger transition-colors"
            aria-label="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </m.button>
        </div>
      </div>
    </m.div>
  );
}