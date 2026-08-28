import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { fmtDate, prettyDate } from '../hooks/useTasks';
import TaskCard from '../components/TaskCard';
import TaskFormModal from '../components/TaskFormModal';
import SkeletonCard from '../components/SkeletonCard';

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
  const { getTasks, getCategories, deleteTask } = useApi();

  const specialId = SPECIAL_CATEGORY_IDS.includes(id) ? id : null;
  const categoryId = Number(id);
  const date = dateParam || fmtDate(new Date());

  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, [getCategories]);

  useEffect(() => {
    let cancelled = false;
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
  }, [date, getTasks]);

  const categoryTasks = useMemo(() => {
    if (specialId === 'fixed') return tasks.filter((t) => t.is_global && !t.already_added);
    if (specialId === 'uncategorized') return tasks.filter((t) => !t.is_global && t.category_id == null);
    if (specialId === 'completed') return tasks.filter((t) => t.status === 'completed');
    return tasks.filter((t) => t.category_id === categoryId);
  }, [specialId, categoryId, tasks]);

  const sortedTasks = specialId === 'completed' ? categoryTasks : sortActiveFirst(categoryTasks);

  const updateLocalTask = (taskId, patch) => {
    setTasks((prev) => prev.map((t) => (t.task_id === taskId ? { ...t, ...patch } : t)));
  };

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

  const handleDelete = async (taskId) => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
      await deleteTask(taskId);
      removeLocalTask(taskId);
    } catch {
      // Best-effort — the task list will simply show it again on next load
      // if the delete failed; no toast context available on this page.
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-fg">{name}</h1>
          <p className="text-sm text-muted mt-0.5">{prettyDate(date)}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-danger/10 border border-danger/30 text-center text-sm text-danger">
          {error}
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="p-10 rounded-2xl bg-surface border border-border text-center">
          <p className="text-sm text-muted">
            {specialId === 'completed' ? 'Nothing completed here yet today.' : 'No tasks in this category for this date.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.task_id}
              task={task}
              date={date}
              variant={specialId === 'fixed' ? 'template' : 'full'}
              isReadOnly={dateParam ? dateParam !== fmtDate(new Date()) : false}
              onEdit={openEdit}
              onDelete={handleDelete}
              onUpdate={(patch) => updateLocalTask(task.task_id, patch)}
            />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted">
        {specialId === 'completed'
          ? `${sortedTasks.length} task${sortedTasks.length === 1 ? '' : 's'} completed`
          : `${sortedTasks.length} task${sortedTasks.length === 1 ? '' : 's'} total`}
      </p>

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
