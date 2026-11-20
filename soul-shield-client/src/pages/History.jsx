import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarX2 } from 'lucide-react';
import { useHistory } from '../hooks/useHistory';
import { fmtDate, parseDateKey } from '../hooks/useTasks';
import DateRangePicker from '../components/DateRangePicker';
import Heatmap from '../components/Heatmap';
import WeeklyStats from '../components/WeeklyStats';
import DayGroup from '../components/DayGroup';
import PageHeader, { SectionHeader } from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Skeleton, SkeletonGroup, StatGridSkeleton } from '../components/ui/Skeleton';

// Days per page in the daily breakdown. A 90-day range would otherwise
// render every task card of every day at once.
const DAYS_PER_PAGE = 7;

function HistorySkeleton() {
  return (
    <SkeletonGroup label="Loading history…" className="space-y-6">
      <StatGridSkeleton />
      <div className="card p-5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-3 w-40" />
        <Skeleton className="mt-5 h-[124px] w-full" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="card flex items-center gap-3 px-5 py-3">
          <Skeleton className="h-11 w-11 rounded-[10px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-1.5 w-32 rounded-full" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}

export default function History() {
  const { range, setRange, byDate, sortedDates, stats, loading, error, reload } = useHistory();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const breakdownRef = useRef(null);

  // A new range starts the breakdown from its first page.
  const changeRange = (next) => {
    setPage(1);
    setRange(next);
  };

  // Open that day on the dashboard (the old handler set a '#/day/…' hash
  // that no route listened to, so clicking did nothing).
  const handleDateClick = (date) => {
    navigate(`/?date=${fmtDate(date)}`);
  };

  const totalPages = Math.max(1, Math.ceil(sortedDates.length / DAYS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageDates = sortedDates.slice((currentPage - 1) * DAYS_PER_PAGE, currentPage * DAYS_PER_PAGE);

  const goToPage = (p) => {
    setPage(p);
    breakdownRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="History"
        description="Streaks, completion and every day in the range you pick"
        actions={<DateRangePicker range={range} setRange={changeRange} />}
      />

      {loading && <HistorySkeleton />}

      {error && !loading && <ErrorState title="Couldn't load your history" message={error} onRetry={() => reload()} />}

      {!loading && !error && (
        <>
          {/* Stats */}
          {stats.totalTasks > 0 && <WeeklyStats stats={stats} />}

          {/* Heatmap */}
          <Heatmap byDate={byDate} range={range} onDateClick={handleDateClick} />

          {/* Day groups */}
          {sortedDates.length > 0 ? (
            <section ref={breakdownRef} aria-label="Daily breakdown" className="scroll-mt-20">
              <SectionHeader title="Daily breakdown" meta={`${sortedDates.length} day${sortedDates.length === 1 ? '' : 's'}`} />
              <div className="space-y-3">
                {pageDates.map(date => (
                  <DayGroup
                    key={date}
                    date={parseDateKey(date)}
                    tasks={byDate[date]}
                  />
                ))}
              </div>
              <Pagination
                className="mt-5"
                page={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                label="Daily breakdown pages"
              />
            </section>
          ) : (
            <EmptyState
              icon={CalendarX2}
              title="No history yet"
              description="Complete some tasks and your progress will show up here"
            />
          )}
        </>
      )}
    </div>
  );
}
