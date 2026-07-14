import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { prettyDate, fmtDate } from '../hooks/useTasks';
import TaskCard from './TaskCard';

export default function DayGroup({ date, tasks, onNavigateToDay }) {
  const [open, setOpen] = useState(true);

  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const isToday = fmtDate(date) === fmtDate(new Date());

  const statusIcon = pct === 100
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    : pct === 0
    ? <XCircle className="w-4 h-4 text-rose-400" />
    : <Clock className="w-4 h-4 text-amber-500" />;

  return (
    <motion.div
      layout
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
    >
      {/* Day header */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
      >
        <motion.div animate={{ rotate: open ? 0 : -90 }}>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </motion.div>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0
            ${isToday ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <span className="text-[9px] font-semibold uppercase leading-none">
              {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
            <span className="text-sm font-bold leading-none mt-0.5">
              {new Date(date).getDate()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {prettyDate(date)}
              {isToday && <span className="ml-2 text-[10px] font-bold uppercase text-indigo-600">Today</span>}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                <motion.div
                  className={`h-full rounded-full ${
                    pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-indigo-500' : 'bg-slate-300'
                  }`}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 100 }}
                />
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {completed}/{total}
              </span>
            </div>
          </div>
        </div>

        {statusIcon}
      </motion.button>

      {/* Tasks */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-100"
          >
            <div className="p-4 pt-3 grid gap-2 md:grid-cols-2">
              {tasks.map(t => (
                <TaskCard
                  key={t.task_id}
                  task={t}
                  date={new Date(t.date)}
                  isReadOnly
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onUpdate={() => {}}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}