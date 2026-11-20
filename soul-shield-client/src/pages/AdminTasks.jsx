import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Shield, Plus, Search, Users, TrendingUp, CheckCircle2, XCircle, ArrowUpDown, Trash2, SearchX,
} from 'lucide-react';
import { useAdminTasks } from '../hooks/useAdminTasks';
import { useApi } from '../context/ApiContext';
import { useToast } from '../components/Toast';
import AdminTaskRow from '../components/AdminTaskRow';
import TaskFormModal from '../components/TaskFormModal';
import ConfirmModal from '../components/ConfirmModal';
import BulkActionBar from '../components/BulkActionBar';
import CommunityOverview from '../components/CommunityOverview';
import StatCard from '../components/StatCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Alert from '../components/ui/Alert';
import SegmentedControl from '../components/ui/SegmentedControl';
import Pagination from '../components/ui/Pagination';
import PageHeader, { SectionHeader } from '../components/ui/PageHeader';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Skeleton, SkeletonGroup, StatGridSkeleton } from '../components/ui/Skeleton';

const SORT_OPTIONS = [
  { key: 'recent',   label: 'Most recent' },
  { key: 'usage',    label: 'Most used' },
  { key: 'rate',     label: 'Completion rate' },
  { key: 'alpha',    label: 'A → Z' },
];

const STATUS_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'normal',   label: 'Normal' },
  { key: 'counter',  label: 'Counter' },
];

// Fixed tasks per page in the list below.
const TASKS_PER_PAGE = 10;

function AdminRowSkeleton() {
  return (
    <div className="card flex items-start gap-3 p-4 sm:p-5">
      <Skeleton className="mt-1 h-[18px] w-[18px] rounded-[5px]" />
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="mt-3 h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function AdminTasks() {
  const toast = useToast();
  const { tasks, usage, overview, loading, error, reload, updateTask, removeTask } = useAdminTasks();

  // UI state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);

  // Changing what's listed starts again from the first page.
  const updateSearch = (value) => { setSearch(value); setPage(1); };
  const updateTypeFilter = (value) => { setTypeFilter(value); setPage(1); };
  const updateSortBy = (value) => { setSortBy(value); setPage(1); };

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
    // Overall rate = all completions / all opportunities (not an unweighted
    // mean of per-task rates, which let a rarely-scheduled task skew it).
    const totalOpportunities = Object.values(usage).reduce((s, u) => s + (u.total || 0), 0);
    const avgRate = totalOpportunities === 0 ? 0 : Math.min(100, Math.round((totalCompletions / totalOpportunities) * 100));
    return {
      totalTasks: tasks.length,
      totalCompletions,
      avgRate,
    };
  }, [tasks, usage]);

  // ---------- Pagination (client-side over the filtered list) ----------
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageTasks = filteredTasks.slice((currentPage - 1) * TASKS_PER_PAGE, currentPage * TASKS_PER_PAGE);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Fixed tasks"
        description="Fixed tasks are visible to every user in the system."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New fixed task
          </Button>
        }
      />

      {/* Summary cards */}
      {loading ? (
        <SkeletonGroup label="Loading summary…">
          <StatGridSkeleton count={3} className="grid grid-cols-1 gap-3 sm:grid-cols-3" />
        </SkeletonGroup>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={Shield} accent label="Fixed tasks" value={summaryStats.totalTasks} />
          <StatCard icon={CheckCircle2} label="Completions (30d)" value={summaryStats.totalCompletions} delay={0.04} />
          <StatCard icon={TrendingUp} label="Avg. completion rate" value={summaryStats.avgRate} suffix="%" delay={0.08} />
        </div>
      )}

      {/* Search + Filters */}
      <section aria-label="Search and filters" className="card flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-end">
        <Input
          className="flex-1"
          size="md"
          label="Search"
          type="search"
          icon={Search}
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
          placeholder="Title, description, or category"
          trailing={
            search ? (
              <button
                type="button"
                onClick={() => updateSearch('')}
                aria-label="Clear search"
                className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-fg"
              >
                <XCircle className="h-4 w-4" />
              </button>
            ) : null
          }
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-fg-2">Type</p>
            <SegmentedControl
              ariaLabel="Filter by task type"
              options={STATUS_FILTERS.map((f) => ({ value: f.key, label: f.label }))}
              value={typeFilter}
              onChange={updateTypeFilter}
              size="lg"
            />
          </div>
          <Select
            label="Sort by"
            size="md"
            icon={ArrowUpDown}
            value={sortBy}
            onChange={(e) => updateSortBy(e.target.value)}
            className="sm:w-48"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </Select>
        </div>
      </section>

      {/* Error */}
      {error && !loading && <ErrorState title="Couldn't load fixed tasks" message={error} onRetry={() => reload()} />}

      {/* Loading */}
      {loading && (
        <SkeletonGroup label="Loading fixed tasks…" className="space-y-3">
          {[1, 2, 3].map(i => <AdminRowSkeleton key={i} />)}
        </SkeletonGroup>
      )}

      {/* Task list */}
      {!loading && !error && (
        <>
          {filteredTasks.length > 0 ? (
            <section aria-label="Fixed tasks">
              <SectionHeader
                title="All fixed tasks"
                meta={filteredTasks.length === tasks.length ? tasks.length : `${filteredTasks.length} of ${tasks.length}`}
              />
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {pageTasks.map(task => (
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
              </div>
              <Pagination
                className="mt-5"
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                label="Fixed task pages"
              />
            </section>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No fixed tasks yet"
              description="Fixed tasks appear on every user's dashboard — great for daily reminders, ibadah routines, or company-wide goals."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Create first fixed task
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No matches"
              description="No fixed tasks match these filters."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    updateSearch('');
                    updateTypeFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}

          {/* Community */}
          {tasks.length > 0 && (
            <section aria-label="Community">
              <SectionHeader title="Community" />
              <CommunityOverview overview={overview} />
            </section>
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
        icon={Trash2}
        title={`Delete "${deletingTask?.title}"?`}
        message="This fixed task will be removed from every user's dashboard immediately."
        confirmLabel="Delete task"
        variant="danger"
      >
        {deletingTask && usage[deletingTask.task_id] && (
          <Alert tone="warning" icon={Users}>
            <strong className="font-semibold text-fg">{usage[deletingTask.task_id].completions}</strong> completions recorded in the last 30 days.
            Past completion history is preserved — only the task itself will be removed.
          </Alert>
        )}
      </ConfirmModal>

      {/* Bulk delete confirmation */}
      <ConfirmModal
        open={bulkDeleteOpen}
        onClose={() => !deleteLoading && setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        loading={deleteLoading}
        icon={Trash2}
        title={`Delete ${selected.size} fixed task${selected.size === 1 ? '' : 's'}?`}
        message="This will remove them from every user's dashboard. Past completion history is preserved."
        confirmLabel="Delete all selected"
        variant="danger"
      />

      {/* Bulk action bar */}
      <BulkActionBar
        count={selected.size}
        onClear={clearSelection}
        onDeleteSelected={() => setBulkDeleteOpen(true)}
      />
    </div>
  );
}
