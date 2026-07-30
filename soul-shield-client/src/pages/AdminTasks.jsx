import { useState, useMemo, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Shield, Plus, Search, Filter, AlertCircle, Inbox, Users,
  TrendingUp, CheckCircle2, XCircle, ArrowUpDown
} from 'lucide-react';
import { useAdminTasks } from '../hooks/useAdminTasks';
import { useApi } from '../context/ApiContext';
import { useToast } from '../components/Toast';
import AdminTaskRow from '../components/AdminTaskRow';
import TaskFormModal from '../components/TaskFormModal';
import ConfirmModal from '../components/ConfirmModal';
import BulkActionBar from '../components/BulkActionBar';
import LeaderboardPreview from '../components/LeaderboardPreview';
import Button from '../components/ui/Button';
import SkeletonCard from '../components/SkeletonCard';

const SORT_OPTIONS = [
  { key: 'recent',   label: 'Most recent' },
  { key: 'usage',    label: 'Most used' },
  { key: 'rate',     label: 'Completion rate' },
  { key: 'alpha',    label: 'A → Z' },
];

const STATUS_FILTERS = [
  { key: 'all',      label: 'All',       icon: null },
  { key: 'normal',   label: 'Normal',    icon: CheckCircle2 },
  { key: 'counter',  label: 'Counter',   icon: null },
];

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } },
};
const child = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

export default function AdminTasks() {
  const toast = useToast();
  const { tasks, usage, loading, error, reload, updateTask, removeTask } = useAdminTasks();

  // UI state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { getCategories, deleteTask } = useApi();

  // Categories for form modal
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, [getCategories]);

  // ---------- Filtering + Sorting ----------
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category_name || '').toLowerCase().includes(q)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(t => t.task_type === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'alpha') return a.title.localeCompare(b.title);
      if (sortBy === 'usage') {
        const ua = usage[a.task_id]?.completions || 0;
        const ub = usage[b.task_id]?.completions || 0;
        return ub - ua;
      }
      if (sortBy === 'rate') {
        const ra = usage[a.task_id]?.completionRate || 0;
        const rb = usage[b.task_id]?.completionRate || 0;
        return rb - ra;
      }
      // recent (default) — by task_id descending
      return (b.task_id || 0) - (a.task_id || 0);
    });

    return result;
  }, [tasks, search, typeFilter, sortBy, usage]);

  // ---------- Selection ----------
  const toggleSelect = (taskId, val) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (val) next.add(taskId); else next.delete(taskId);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  // ---------- Actions ----------
  const openCreate = () => { setEditingTask(null); setCreateOpen(true); };
  const openEdit = (task) => { setEditingTask(task); setCreateOpen(true); };

  const handleSaved = (saved) => {
    if (editingTask) {
      updateTask(editingTask.task_id, saved);
    } else {
      // The create endpoint doesn't return the full task-with-status shape
      // (task_id, task_type, category, status, etc.) — reload to get it,
      // otherwise the new task renders incorrectly until the next refresh.
      reload();
    }
  };

  // Single delete
  const handleDeleteConfirm = async () => {
    if (!deletingTask) return;
    setDeleteLoading(true);
    try {
      await deleteTask(deletingTask.task_id);
      removeTask(deletingTask.task_id);
      selected.delete(deletingTask.task_id);
      setSelected(new Set(selected));
      toast.success(`"${deletingTask.title}" deleted. Past completion history is preserved.`);
      setDeletingTask(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    setDeleteLoading(true);
    const ids = Array.from(selected);
    let success = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        await deleteTask(id);
        removeTask(id);
        success++;
      } catch {
        failed++;
      }
    }

    if (success > 0) toast.success(`${success} task${success === 1 ? '' : 's'} deleted.`);
    if (failed > 0) toast.error(`${failed} task${failed === 1 ? '' : 's'} couldn't be deleted.`);
    clearSelection();
    setBulkDeleteOpen(false);
    setDeleteLoading(false);
  };

  // ---------- Summary stats ----------
  const summaryStats = useMemo(() => {
    const totalCompletions = Object.values(usage).reduce((s, u) => s + u.completions, 0);
    const avgRate = tasks.length === 0 ? 0 : Math.round(
      Object.values(usage).reduce((s, u) => s + u.completionRate, 0) / Math.max(1, Object.keys(usage).length)
    );
    return {
      totalTasks: tasks.length,
      totalCompletions,
      avgRate,
    };
  }, [tasks, usage]);

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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-7 h-7 text-amber-500" />
            Admin Panel
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage Fixed Tasks — these are visible to every user in the system.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> New Fixed Task
        </Button>
      </m.div>

      {/* Summary cards */}
      <m.div variants={child} className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Fixed Tasks</p>
            <p className="text-xl font-bold text-slate-800 tabular-nums">{summaryStats.totalTasks}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Completions (30d)</p>
            <p className="text-xl font-bold text-slate-800 tabular-nums">{summaryStats.totalCompletions}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Avg. completion rate</p>
            <p className="text-xl font-bold text-slate-800 tabular-nums">{summaryStats.avgRate}%</p>
          </div>
        </div>
      </m.div>

      {/* Search + Filters */}
      <m.div variants={child} className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fixed tasks by title, description, or category..."
            aria-label="Search fixed tasks"
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none text-sm transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100"
            >
              <XCircle className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />

          {/* Type filter */}
          {STATUS_FILTERS.map(f => {
            const active = typeFilter === f.key;
            return (
              <m.button
                key={f.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTypeFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all
                  ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}
                `}
              >
                {f.label}
              </m.button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort fixed tasks"
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white outline-none focus:border-indigo-500"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </m.div>

      {/* Error */}
      {error && (
        <m.div variants={child} className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm text-rose-700 mb-3">{error}</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </m.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Task list */}
      {!loading && !error && (
        <>
          {filteredTasks.length > 0 ? (
            <m.div variants={child} className="space-y-3">
              <AnimatePresence>
                {filteredTasks.map(task => (
                  <AdminTaskRow
                    key={task.task_id}
                    task={task}
                    usage={usage[task.task_id]}
                    selected={selected.has(task.task_id)}
                    onSelect={(val) => toggleSelect(task.task_id, val)}
                    onEdit={openEdit}
                    onDelete={setDeletingTask}
                  />
                ))}
              </AnimatePresence>
            </m.div>
          ) : tasks.length === 0 ? (
            <m.div
              variants={child}
              className="text-center py-16 bg-white rounded-2xl border border-slate-200"
            >
              <m.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 mb-4"
              >
                <Inbox className="w-8 h-8 text-amber-500" />
              </m.div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">No fixed tasks yet</h3>
              <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
                Fixed tasks appear on every user's dashboard — great for daily reminders, ibadah routines, or company-wide goals.
              </p>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" /> Create first fixed task
              </Button>
            </m.div>
          ) : (
            <m.div
              variants={child}
              className="text-center py-12 text-sm text-slate-500"
            >
              No fixed tasks match these filters.
            </m.div>
          )}

          {/* Leaderboard */}
          {!loading && tasks.length > 0 && (
            <m.div variants={child}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <span className="w-6 h-0.5 bg-slate-300" />
                Community
              </h2>
              <LeaderboardPreview />
            </m.div>
          )}
        </>
      )}

      {/* Create/Edit modal — pre-enabled is_global */}
      <TaskFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        task={editingTask}
        categories={categories}
        onSaved={handleSaved}
        forceGlobal
      />

      {/* Single delete confirmation */}
      <ConfirmModal
        open={!!deletingTask}
        onClose={() => !deleteLoading && setDeletingTask(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title={`Delete "${deletingTask?.title}"?`}
        message="This fixed task will be removed from every user's dashboard immediately."
        confirmLabel="Yes, delete it"
        variant="danger"
      >
        {deletingTask && usage[deletingTask.task_id] && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p>
                  <strong>{usage[deletingTask.task_id].completions}</strong> completions recorded in the last 30 days.
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Past completion history is preserved — only the task itself will be removed.
                </p>
              </div>
            </div>
          </div>
        )}
      </ConfirmModal>

      {/* Bulk delete confirmation */}
      <ConfirmModal
        open={bulkDeleteOpen}
        onClose={() => !deleteLoading && setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        loading={deleteLoading}
        title={`Delete ${selected.size} fixed task${selected.size === 1 ? '' : 's'}?`}
        message="This will remove them from every user's dashboard. Past completion history is preserved."
        confirmLabel="Yes, delete all"
        variant="danger"
      />

      {/* Bulk action bar */}
      <BulkActionBar
        count={selected.size}
        onClear={clearSelection}
        onDeleteSelected={() => setBulkDeleteOpen(true)}
      />
    </m.div>
  );
}