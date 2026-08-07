import { useMemo } from 'react';
import { m } from 'framer-motion';
import { CalendarDays, AlertCircle, Inbox } from 'lucide-react';
import { useHistory } from '../hooks/useHistory';
import { fmtDate } from '../hooks/useTasks';
import DateRangePicker from '../components/DateRangePicker';
import Heatmap from '../components/Heatmap';
import WeeklyStats from '../components/WeeklyStats';
import DayGroup from '../components/DayGroup';
import Button from '../components/ui/Button';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { staggerChildren: 0.08 } },
};
const child = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export default function History() {
  const { range, setRange, byDate, sortedDates, stats, loading, error, reload } = useHistory();

  const handleDateClick = (date) => {
    // Jump to that day on the dashboard
    window.location.hash = `#/day/${fmtDate(date)}`;
    // Alternatively, could use a global event or navigate
  };

  return (
    <m.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* Header */}
      <m.div variants={child} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-fg flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" />
            History
          </h1>
          <p className="text-sm text-muted mt-1">
            Look back at your progress and see how you've been doing ✨
          </p>
        </div>
        <DateRangePicker range={range} setRange={setRange} />
      </m.div>

      {/* Error */}
      {error && (
        <m.div variants={child} className="p-6 rounded-2xl bg-danger/10 border border-danger/20 text-center">
          <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
          <p className="text-sm text-danger mb-3">{error}</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </m.div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <>
          <m.div variants={child} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-surface rounded-2xl border border-border p-4 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-border mb-3" />
                <div className="h-3 bg-border rounded w-1/2 mb-2" />
                <div className="h-6 bg-border rounded w-3/4" />
              </div>
            ))}
          </m.div>
          <m.div variants={child} className="bg-surface rounded-2xl border border-border p-5 animate-pulse">
            <div className="h-32 bg-bg rounded" />
          </m.div>
        </>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Stats */}
          {stats.totalTasks > 0 && (
            <m.div variants={child}>
              <WeeklyStats stats={stats} />
            </m.div>
          )}

          {/* Heatmap */}
          <m.div variants={child}>
            <Heatmap byDate={byDate} range={range} onDateClick={handleDateClick} />
          </m.div>

          {/* Day groups */}
          {sortedDates.length > 0 ? (
            <m.div variants={child} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <span className="w-6 h-0.5 bg-border" />
                Daily breakdown
              </h2>
              {sortedDates.map(date => (
                <DayGroup
                  key={date}
                  date={new Date(date)}
                  tasks={byDate[date]}
                />
              ))}
            </m.div>
          ) : (
            <m.div
              variants={child}
              className="text-center py-16 bg-surface rounded-2xl border border-border"
            >
              <m.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-4"
              >
                <Inbox className="w-8 h-8 text-primary" />
              </m.div>
              <h3 className="text-lg font-semibold text-fg mb-1">No history yet</h3>
              <p className="text-sm text-muted">
                Complete some tasks and your progress will show up here.
              </p>
            </m.div>
          )}
        </>
      )}
    </m.div>
  );
}