import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Inbox, AlertCircle } from 'lucide-react';
import { useTasks, prettyDate, fmtDate } from '../hooks/useTasks';
import { api } from '../services/api';
import TaskCard from '../components/TaskCard';
import FilterRow from '../components/FilterRow';
import ProgressSummary from '../components/ProgressSummary';
import TaskFormModal from '../components/TaskFormModal';
import SkeletonCard from '../components/SkeletonCard';
import Button from '../components/ui/Button';

export default function Dashboard() {
  const { date, tasks, loading, error, shiftDate, goToday, isToday, updateTask, removeTask, addTask, reload } = useTasks();
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeStatus, setActiveStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Load categories once
  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => {});
  }, []);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (activeCategory && t.category_id !== activeCategory) return false;
      if (activeStatus !== 'all' && t.status !== activeStatus) return false;
      return true;
    });
  }, [tasks, activeCategory, activeStatus]);

  // Split into Fixed vs My
  const fixedTasks = filteredTasks.filter(t => t.is_global);
  const myTasks = filteredTasks.filter(t => !t.is_global);

  const openCreate = () => { setEditingTask(null); setModalOpen(true); };
  const openEdit = (task) => { setEditingTask(task); setModalOpen(true); };

  const handleSaved = (saved) => {
    // If the saved task matches current date recurrence, add/update it
    if (editingTask) {
      updateTask(editingTask.task_id, saved);
    } else {
      addTask(saved);
    }
    // Refresh categories in case a new one was created inline (future)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            {isToday ? "Today's Tasks" : prettyDate(date)}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isToday ? "Let's make today count ✨" : fmtDate(date)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => shiftDate(-1)}
              className="p-2.5 hover:bg-slate-50 transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </motion.button>
            <div className="px-3 py-2 border-x border-slate-200 min-w-[110px] text-center">
              <p className="text-sm font-semibold text-slate-800">{prettyDate(date)}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => shiftDate(1)}
              className="p-2.5 hover:bg-slate-50 transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </motion.button>
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
        <FilterRow
          categories={categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          activeStatus={activeStatus}
          setActiveStatus={setActiveStatus}
        />
      )}

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center"
        >
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm text-rose-700 mb-3">{error}</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Task lists */}
      {!loading && !error && (
        <div className="space-y-6">
          {/* Fixed Tasks section */}
          {fixedTasks.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-0.5 bg-amber-400" />
                Fixed Tasks
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                <AnimatePresence>
                  {fixedTasks.map(t => (
                    <TaskCard
                      key={t.task_id}
                      task={t}
                      date={date}
                      onEdit={openEdit}
                      onDelete={removeTask}
                      onUpdate={(patch) => updateTask(t.task_id, patch)}
                      isReadOnly={!isToday}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* My Tasks section */}
          {myTasks.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-0.5 bg-indigo-400" />
                My Tasks
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                <AnimatePresence>
                  {myTasks.map(t => (
                    <TaskCard
                      key={t.task_id}
                      task={t}
                      date={date}
                      onEdit={openEdit}
                      onDelete={removeTask}
                      onUpdate={(patch) => updateTask(t.task_id, patch)}
                      isReadOnly={!isToday}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Empty state */}
          {filteredTasks.length === 0 && tasks.length === 0 && isToday && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-4"
              >
                <Inbox className="w-8 h-8 text-indigo-500" />
              </motion.div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">No tasks yet</h3>
              <p className="text-sm text-slate-500 mb-4">Your day is a blank canvas — add your first task!</p>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" /> Add a task
              </Button>
            </motion.div>
          )}

          {filteredTasks.length === 0 && tasks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-12 text-sm text-slate-500"
            >
              No tasks match these filters. Try clearing them.
            </motion.div>
          )}
        </div>
      )}

      {/* Floating add button */}
      {isToday && !loading && (
        <motion.button
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={openCreate}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-300 flex items-center justify-center z-40"
          aria-label="Add task"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
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