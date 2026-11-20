import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, CalendarCheck, Shield, CheckCircle2, Tag, Inbox, SearchX } from 'lucide-react';
import { useTasks, prettyDate, fmtDate } from '../hooks/useTasks';
import { useApi } from '../context/ApiContext';
import CategoryRow from '../components/CategoryRow';
import FilterRow from '../components/FilterRow';
import ProgressSummary from '../components/ProgressSummary';
import TaskFormModal from '../components/TaskFormModal';
import Button from '../components/ui/Button';
import PageHeader, { SectionHeader } from '../components/ui/PageHeader';
import Tooltip from '../components/ui/Tooltip';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Skeleton, SkeletonGroup, ListSkeleton } from '../components/ui/Skeleton';

const FIXED_SECTION_ID = 'fixed';
const UNCATEGORIZED_SECTION_ID = 'uncategorized';
const COMPLETED_SECTION_ID = 'completed';

/** `?date=YYYY-MM-DD` (e.g. from a History heatmap click) opens that day,
 * parsed as a local date; anything else falls back to today. */
function parseDateParam(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const [y, mo, d] = value.split('-').map(Number);
  const parsed = new Date(y, mo - 1, d);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function DashboardSkeleton() {
  return (
    <SkeletonGroup label="Loading your tasks…" className="space-y-6">
      <div className="card p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2.5 h-7 w-32" />
        <Skeleton className="mt-5 h-2 w-full rounded-full" />
      </div>
      <Skeleton className="h-9 w-72 max-w-full rounded-[10px]" />
      <ListSkeleton rows={4} />
    </SkeletonGroup>
  );
}

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const { date, tasks, loading, error, shiftDate, goToday, isToday, updateTask, reload } = useTasks(
    parseDateParam(searchParams.get('date'))
  );
  const [categories, setCategories] = useState([]);
  const [activeStatus, setActiveStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const { getCategories } = useApi();
  const navigate = useNavigate();

  // Load categories once
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, [getCategories]);

  // Client-side filtering (status only — category is now navigation, not a filter, see FilterRow.jsx)
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (activeStatus !== 'all' && t.status !== activeStatus) return false;
      return true;
    });
  }, [tasks, activeStatus]);

  const statusCounts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    missed: tasks.filter(t => t.status === 'missed').length,
  }), [tasks]);

  // Completed tasks get pulled into their own row regardless of category;
  // every other row only ever counts active (non-completed) tasks.
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');
  const activeTasks = filteredTasks.filter(t => t.status !== 'completed');

  const fixedTasks = activeTasks.filter(t => t.is_global && !t.already_added);
  const myTasks = activeTasks.filter(t => !t.is_global);

  // Mirrors the mobile app's category-section derivation: one row per real
  // category (even if empty) plus an "Uncategorized" row for personal tasks
  // with no category — both built from the same day's already-loaded task
  // list rather than a separate per-category backend call.
  const categorySections = useMemo(() => {
    const byCategory = new Map();
    const uncategorized = [];
    for (const task of myTasks) {
      if (task.category_id == null) {
        uncategorized.push(task);
      } else {
        const list = byCategory.get(task.category_id);
        if (list) list.push(task);
        else byCategory.set(task.category_id, [task]);
      }
    }
    return [
      ...categories.map((cat) => ({
        id: String(cat.id),
        title: cat.name,
        accentColor: cat.color_hex,
        count: (byCategory.get(cat.id) || []).length,
      })),
      {
        id: UNCATEGORIZED_SECTION_ID,
        title: 'Uncategorized',
        accentColor: '#94a3b8',
        count: uncategorized.length,
      },
    ];
  }, [categories, myTasks]);

  const visibleSections = categorySections.filter((section) => section.count > 0);
  const groupCount = (fixedTasks.length > 0 ? 1 : 0) + visibleSections.length + (completedTasks.length > 0 ? 1 : 0);

  const openCreate = () => { setEditingTask(null); setModalOpen(true); };

  const openSection = (id, title) => {
    navigate(`/category/${id}?name=${encodeURIComponent(title)}&date=${fmtDate(date)}`);
  };

  const handleSaved = (saved) => {
    // If the saved task matches current date recurrence, add/update it
    if (editingTask) {
      updateTask(editingTask.task_id, saved);
    } else {
      // The create endpoint doesn't return the full task-with-status shape
      // (task_id, task_type, category, status, etc.) — reload to get it,
      // otherwise the new task renders incorrectly until the next refresh.
      reload();
    }
    // Refresh categories in case a new one was created inline (future)
  };

  const canCreate = isToday && !loading;
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow={isToday ? `${weekday} · Today` : weekday}
        title={isToday ? "Today's tasks" : prettyDate(date)}
        description={isToday ? "Let's make today count." : `Viewing ${fmtDate(date)}`}
        actions={
          <>
            {/* Day stepper */}
            <div className="inline-flex h-10 items-center rounded-[9px] border border-border bg-surface shadow-[inset_0_-1px_0_var(--edge-bottom),var(--elev-1)]">
              <Tooltip label="Previous day">
                <button
                  type="button"
                  onClick={() => shiftDate(-1)}
                  aria-label="Previous day"
                  className="inline-flex h-[38px] w-9 items-center justify-center rounded-l-[8px] text-muted transition-colors hover:bg-sunken hover:text-fg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </Tooltip>
              <span className="min-w-[104px] border-x border-border px-3 text-center text-[13px] font-semibold tabular-nums text-fg" aria-live="polite">
                {prettyDate(date)}
              </span>
              <Tooltip label="Next day">
                <button
                  type="button"
                  onClick={() => shiftDate(1)}
                  aria-label="Next day"
                  className="inline-flex h-[38px] w-9 items-center justify-center rounded-r-[8px] text-muted transition-colors hover:bg-sunken hover:text-fg"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>

            {!isToday && (
              <Button variant="secondary" onClick={goToday}>
                <CalendarCheck className="h-4 w-4" /> Today
              </Button>
            )}

            {canCreate && (
              <Button onClick={openCreate} className="hidden sm:inline-flex">
                <Plus className="h-4 w-4" /> New task
              </Button>
            )}
          </>
        }
      />

      {loading && <DashboardSkeleton />}

      {error && !loading && (
        <ErrorState title="Couldn't load your tasks" message={error} onRetry={() => reload()} />
      )}

      {!loading && !error && (
        <>
          {/* Progress */}
          {tasks.some(t => !t.is_global) && <ProgressSummary tasks={tasks} />}

          {tasks.length > 0 && (
            <section aria-label="Task groups">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <SectionHeader title="Task groups" meta={groupCount} className="!mb-0" />
                <FilterRow activeStatus={activeStatus} setActiveStatus={setActiveStatus} counts={statusCounts} />
              </div>

              {/* Category-wise rows — collapsed summaries, each opening its own
                  dedicated page (see pages/CategoryDetail.jsx) rather than showing
                  every task inline here, mirroring the mobile app's dashboard. */}
              {filteredTasks.length > 0 ? (
                <m.div
                  key={activeStatus}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="card divide-y divide-border overflow-hidden"
                >
                  {fixedTasks.length > 0 && (
                    <CategoryRow
                      title="Fixed Tasks"
                      count={fixedTasks.length}
                      accentColor="var(--color-warning)"
                      icon={Shield}
                      onClick={() => openSection(FIXED_SECTION_ID, 'Fixed Tasks')}
                    />
                  )}
                  {visibleSections.map((section) => (
                    <CategoryRow
                      key={section.id}
                      title={section.title}
                      count={section.count}
                      accentColor={section.accentColor}
                      icon={section.id === UNCATEGORIZED_SECTION_ID ? Tag : undefined}
                      onClick={() => openSection(section.id, section.title)}
                    />
                  ))}
                  {completedTasks.length > 0 && (
                    <CategoryRow
                      title="Completed Tasks"
                      count={completedTasks.length}
                      accentColor="var(--color-success)"
                      icon={CheckCircle2}
                      onClick={() => openSection(COMPLETED_SECTION_ID, 'Completed Tasks')}
                    />
                  )}
                </m.div>
              ) : (
                <EmptyState
                  icon={SearchX}
                  title="No tasks match this filter"
                  description="Try another status, or show everything for this day."
                  action={<Button variant="secondary" onClick={() => setActiveStatus('all')}>Show all tasks</Button>}
                />
              )}
            </section>
          )}

          {tasks.length === 0 && (
            isToday ? (
              <EmptyState
                icon={Inbox}
                title="No tasks yet"
                description="Your day is a blank canvas — add your first task to get started."
                action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add a task</Button>}
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="Nothing scheduled"
                description="There were no tasks on this day."
                action={<Button variant="secondary" onClick={goToday}><CalendarCheck className="h-4 w-4" /> Back to today</Button>}
              />
            )
          )}
        </>
      )}

      {/* Floating add button (phones; larger screens use the header button).
          Portaled so the page's entrance animation can never offset it. */}
      {canCreate && createPortal(
        <m.button
          type="button"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          onClick={openCreate}
          className="btn btn-primary fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 h-14 w-14 rounded-2xl sm:hidden"
          aria-label="Add task"
        >
          <Plus className="h-6 w-6" />
        </m.button>,
        document.body
      )}

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
        categories={categories}
        onSaved={handleSaved}
      />
    </div>
  );
}
