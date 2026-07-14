import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, AlertCircle, Inbox } from 'lucide-react';
import { useHistory } from '../hooks/useHistory';
import { fmtDate } from '../hooks/useTasks';
import DateRangePicker from '../components/DateRangePicker';
import Heatmap from '../components/Heatmap';
import WeeklyStats from '../components/WeeklyStats';
import DayGroup from '../components/DayGroup';
import Button from '../components/ui/Button';

export default function History() {
  const { range, setRange, byDate, sortedDates, stats, loading, error, reload } = useHistory();

  const handleDateClick = (date) => {
    // Jump to that day on the dashboard
    window.location.hash = `#/day/${fmtDate(date)}`;
    // Alternatively, could use a global event or navigate
  };

  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { staggerChildren: 0.08 } },
  };
  const child = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={child} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-indigo-500" />
            History
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Look back at your progress and see how you've been doing ✨
          </p>
        </div>
        <DateRangePicker range={range} setRange={setRange} />
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div variants={child} className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm text-rose-700 mb-3">{error}</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <>
          <motion.div variants={child} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-slate-200 mb-3" />
                <div className="h-3 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-6 bg-slate-200 rounded w-3/4" />
              </div>
            ))}
          </motion.div>
          <motion.div variants={child} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
            <div className="h-32 bg-slate-100 rounded" />
          </motion.div>
        </>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Stats */}
          {stats.totalTasks > 0 && (
            <motion.div variants={child}>
              <WeeklyStats stats={stats} />
            </motion.div>
          )}

          {/* Heatmap */}
          <motion.div variants={child}>
            <Heatmap byDate={byDate} range={range} onDateClick={handleDateClick} />
          </motion.div>

          {/* Day groups */}
          {sortedDates.length > 0 ? (
            <motion.div variants={child} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <span className="w-6 h-0.5 bg-slate-300" />
                Daily breakdown
              </h2>
              {sortedDates.map(date => (
                <DayGroup
                  key={date}
                  date={new Date(date)}
                  tasks={byDate[date]}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              variants={child}
              className="text-center py-16 bg-white rounded-2xl border border-slate-200"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-4"
              >
                <Inbox className="w-8 h-8 text-indigo-500" />
              </motion.div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">No history yet</h3>
              <p className="text-sm text-slate-500">
                Complete some tasks and your progress will show up here.
              </p>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}