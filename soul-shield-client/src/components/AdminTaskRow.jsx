import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Shield, Tag, Calendar, Repeat, Check, X } from 'lucide-react';
import UsageBadge from './UsageBadge';

const RECURRENCE_LABELS = {
  daily: 'Every day',
  weekly: 'Weekly',
  custom: 'Custom',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminTaskRow({ task, usage, selected, onSelect, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);

  const categoryColor = task.category_color || '#94a3b8';
  const recurrenceLabel = RECURRENCE_LABELS[task.recurrence_type] || task.recurrence_type;

  // Build day pills for weekly/custom
  const dayPills = task.recurrence_type !== 'daily' && task.recurrence_days
    ? task.recurrence_days.map(d => DAY_NAMES[d]).join(', ')
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={`group bg-white rounded-2xl border-2 overflow-hidden transition-all
        ${selected ? 'border-indigo-400 bg-indigo-50/30 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}
      `}
      style={{ borderLeftWidth: '4px', borderLeftColor: categoryColor }}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Selection checkbox */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => onSelect(!selected)}
          className={`mt-1 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
            ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-500'}
          `}
        >
          {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </motion.button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 text-base leading-snug truncate">
                {task.title}
              </h3>
              {task.description && (
                <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
              )}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {task.task_type === 'counter' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wide">
                  🔢 Counter · {task.target_count}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                <Shield className="w-3 h-3" /> Fixed
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
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
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onEdit(task)}
            className="p-2 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            aria-label="Edit task"
          >
            <Edit2 className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(task)}
            className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            aria-label="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}