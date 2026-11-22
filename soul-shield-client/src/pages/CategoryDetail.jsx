import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Inbox, CheckCircle2, ChevronDown } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { fmtDate, prettyDate } from '../hooks/useTasks';
import TaskCard from '../components/TaskCard';
import TaskFormModal from '../components/TaskFormModal';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import { EmptyState, ErrorState } from '../components/ui/States';
import { SkeletonGroup, TaskCardSkeleton } from '../components/ui/Skeleton';
import { groupFixedTasksByCategory } from '../utils/groupFixedTasks';
import { cn } from '../utils/cn';

const SPECIAL_CATEGORY_IDS = ['fixed', 'uncategorized', 'completed'];

/** Active tasks first, completed ones last — mirrors the mobile app's same
 * client-side sort (Array.sort is stable, so each group keeps its original
 * relative order otherwise). */
function sortActiveFirst(tasks) {
  return [...tasks].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed'));
}

/** Full task list for one dashboard category row (a real category, or one
 * of the three pseudo-categories the dashboard also shows as rows: Fixed
 * Tasks, Uncategorized, Completed Tasks) — mirrors the mobile app's
 * category/[id].tsx, deriving every grouping client-side from the same
 * day's full task list rather than a separate per-category backend call. */
export default function CategoryDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name') || 'Category';
  const dateParam = searchParams.get('date');
  const navigate = useNavigate();
  const { getTasks, getCategories } = useApi();

  const specialId = SPECIAL_CATEGORY_IDS.includes(id) ? id : null;
  const categoryId = Number(id);
  const date = dateParam || fmtDate(new Date());

  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  // Bumped by "Try again" to re-run the load effect.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, [getCategories]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this effect starts
    setLoading(true);
    setError(null);
    getTasks(date)
      .then((data) => {
        if (!cancelled) setTasks(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, getTasks, reloadKey]);

  const categoryTasks = useMemo(() => {
    if (specialId === 'fixed') return tasks.filter((t) => t.is_global && !t.already_added);
    if (specialId === 'uncategorized') return tasks.filter((t) => !t.is_global && t.category_id == null);
    if (specialId === 'completed') return tasks.filter((t) => t.status === 'completed');
    return tasks.filter((t) => t.category_id === categoryId);
  }, [specialId, categoryId, tasks]);

  const sortedTasks = specialId === 'completed' ? categoryTasks : sortActiveFirst(categoryTasks);
  const doneCount = categoryTasks.filter((t) => t.status === 'completed').length;

  // Fixed tasks: grouped by the admin's categories, each one collapsible.
  const fixedGroups = useMemo(
    () => (specialId === 'fixed' ? groupFixedTasksByCategory(sortedTasks) : []),
    [specialId, sortedTasks]
  );
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  // With a single group there's nothing to browse - show it open.
  const isGroupExpanded = (key) => fixedGroups.length === 1 || expandedGroups.has(key);
  const toggleGroup = (key) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const updateLocalTask = (taskId, patch) => {
    setTasks((prev) => prev.map((t) => (t.task_id === taskId ? { ...t, ...patch } : t)));
  };

  // TaskCard confirms and performs the DELETE itself, then reports the id
  // here; this page only drops it from the list. (It used to confirm and
  // call DELETE a second time, which 404'd and left the task on screen.)
  const removeLocalTask = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleSaved = (saved) => {
    if (editingTask) {
      updateLocalTask(editingTask.task_id, saved);
    } else {
      // Create endpoint doesn't return the full task-with-status shape — a
      // freshly created task also wouldn't necessarily belong to this
      // category's current filtered view anyway, so just go back rather
      // than guessing how to splice it in here.
      navigate(-1);
    }
  };

  const isReadOnly = dateParam ? dateParam !== fmtDate(new Date()) : false;

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
        eyebrow={prettyDate(date)}
        title={name}
        actions={
          !loading && !error && sortedTasks.length > 0 ? (
            specialId === 'completed' ? (
              <Badge tone="success" icon={CheckCircle2}>
                {sortedTasks.length} completed
              </Badge>
            ) : (
              <Badge tone="neutral">
                {doneCount} of {sortedTasks.length} done
              </Badge>
            )
          ) : null
        }
      />

      {isReadOnly && !loading && !error && sortedTasks.length > 0 && (
        <p className="text-[13px] text-muted">You're viewing a past or future day, so these tasks are read-only.</p>
      )}

      {loading ? (
        <SkeletonGroup label="Loading tasks…" className="grid gap-3 md:grid-cols-2">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </SkeletonGroup>
      ) : error ? (
        <ErrorState title="Couldn't load these tasks" message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : sortedTasks.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={specialId === 'completed' ? 'Nothing completed yet' : 'No tasks here'}
          description={
            specialId === 'completed' ? 'Nothing completed here yet today.' : 'No tasks in this category for this date.'
          }
          action={
            <Button variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Go back
            </Button>
          }
        />
      ) : specialId === 'fixed' ? (
        <div className="space-y-3">
          {fixedGroups.map((group) => {
            const expanded = isGroupExpanded(group.key);
            const panelId = `fixed-group-${group.key}`;
            return (
              <section key={group.key} className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="card card-interactive flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: group.color || 'var(--primary-ink)' }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{group.name ?? 'Uncategorized'}</span>
                  <Badge tone="neutral">{group.tasks.length}</Badge>
                  <ChevronDown
                    className={cn('h-4 w-4 shrink-0 text-muted transition-transform', expanded && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
                {expanded && (
                  <div id={panelId} className="grid items-start gap-3 md:grid-cols-2 sm:pl-4">
                    <AnimatePresence initial={false}>
                      {group.tasks.map((task) => (
                        <TaskCard
                          key={task.task_id}
                          task={task}
                          date={date}
                          variant="template"
                          isReadOnly={isReadOnly}
                          onEdit={openEdit}
                          onDelete={removeLocalTask}
                          onUpdate={(patch) => updateLocalTask(task.task_id, patch)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {sortedTasks.map((task) => (
              <TaskCard
                key={task.task_id}
                task={task}
                date={date}
                variant={specialId === 'fixed' ? 'template' : 'full'}
                isReadOnly={isReadOnly}
                onEdit={openEdit}
                onDelete={removeLocalTask}
                onUpdate={(patch) => updateLocalTask(task.task_id, patch)}
              />
            ))}
          </AnimatePresence>
        </div>
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
