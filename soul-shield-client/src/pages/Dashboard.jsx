import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Inbox, AlertCircle, Shield, CheckCircle2, Tag } from 'lucide-react';
import { useTasks, prettyDate, fmtDate } from '../hooks/useTasks';
import { useApi } from '../context/ApiContext';
import CategoryRow from '../components/CategoryRow';
import FilterRow from '../components/FilterRow';
import ProgressSummary from '../components/ProgressSummary';
import TaskFormModal from '../components/TaskFormModal';
import SkeletonCard from '../components/SkeletonCard';
import Button from '../components/ui/Button';

const FIXED_SECTION_ID = 'fixed';
const UNCATEGORIZED_SECTION_ID = 'uncategorized';
const COMPLETED_SECTION_ID = 'completed';

export default function Dashboard() {
  const { date, tasks, loading, error, shiftDate, goToday, isToday, updateTask, reload } = useTasks();
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

  // Completed tasks get pulled into their own row regardless of category;
  // every other row only ever counts active (non-completed) tasks.
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');
  const activeTasks = filteredTasks.filter(t => t.status !== 'completed');

  const fixedTasks = activeTasks.filter(t => t.is_global);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-fg">
            {isToday ? "Today's Tasks" : prettyDate(date)}
          </h1>
          <p className="text-sm text-muted mt-1">
            {isToday ? "Let's make today count ✨" : fmtDate(date)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface border border-border rounded-xl overflow-hidden">
            <m.button
              whileTap={{ scale: 0.9 }}
              onClick={() => shiftDate(-1)}
              className="p-2.5 hover:bg-bg transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-5 h-5 text-muted" />
            </m.button>
            <div className="px-3 py-2 border-x border-border min-w-[110px] text-center">
              <p className="text-sm font-semibold text-fg">{prettyDate(date)}</p>
            </div>
            <m.button
              whileTap={{ scale: 0.9 }}
              onClick={() => shiftDate(1)}
              className="p-2.5 hover:bg-bg transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-5 h-5 text-muted" />
            </m.button>
          </div>

          {!isToday && (
            <Button variant="secondary" onClick={goToday} className="!py-2.5 !px-3">
              <RotateCcw className="w-4 h-4" /> Today
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {!loading && !error && tasks.length > 0 && (
        <ProgressSummary tasks={tasks} />
      )}

      {/* Filters */}
      {!loading && !error && tasks.length > 0 && (
        <FilterRow activeStatus={activeStatus} setActiveStatus={setActiveStatus} />
      )}

      {/* Error state */}
      {error && (
        <m.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-danger/10 border border-danger/30 text-center"
        >
          <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
          <p className="text-sm text-danger mb-3">{error}</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </m.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Category-wise rows — collapsed summaries, each opening its own
          dedicated page (see pages/CategoryDetail.jsx) rather than showing
          every task inline here, mirroring the mobile app's dashboard. */}
      {!loading && !error && filteredTasks.length > 0 && (
        <div className="space-y-2.5">
          <CategoryRow
            title="Fixed Tasks"
            count={fixedTasks.length}
            accentColor="var(--color-warning)"
            icon={Shield}
            onClick={() => openSection(FIXED_SECTION_ID, 'Fixed Tasks')}
          />
          {categorySections.map((section) => (
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
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && (
        <>
          {filteredTasks.length === 0 && tasks.length === 0 && isToday && (
            <m.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <m.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-4"
              >
                <Inbox className="w-8 h-8 text-primary" />
              </m.div>
              <h3 className="text-lg font-semibold text-fg mb-1">No tasks yet</h3>
              <p className="text-sm text-muted mb-4">Your day is a blank canvas — add your first task!</p>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" /> Add a task
              </Button>
            </m.div>
          )}

          {filteredTasks.length === 0 && tasks.length > 0 && (
            <m.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-12 text-sm text-muted"
            >
              No tasks match these filters. Try clearing them.
            </m.div>
          )}
        </>
      )}

      {/* Floating add button */}
      {isToday && !loading && (
        <m.button
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={openCreate}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-300 flex items-center justify-center z-40"
          aria-label="Add task"
        >
          <Plus className="w-6 h-6" />
        </m.button>
      )}

      {/* Modal */}
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