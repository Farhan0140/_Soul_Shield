import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Tags, Trash2 } from 'lucide-react';
import { fmtDate } from '../hooks/useTasks';
import { useApi } from '../context/ApiContext';
import { useToast } from '../components/Toast';
import CategoryCard from '../components/CategoryCard';
import CategoryFormModal from '../components/CategoryFormModal';
import ConfirmModal from '../components/ConfirmModal';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Skeleton, SkeletonGroup } from '../components/ui/Skeleton';

function CategorySkeleton() {
  return (
    <div className="card flex items-center gap-4 p-4 sm:p-5">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export default function Categories() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getCategories, getTasksHistory, deleteCategory } = useApi();

  // Task usage counts per category (from last 30 days of history)
  const [usageCounts, setUsageCounts] = useState({});

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState(null); // category being deleted
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load usage counts in parallel (non-blocking — best effort)
  const loadUsageCounts = async () => {
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 30);
      // Local calendar days, matching every other date the app sends.
      const history = await getTasksHistory(fmtDate(from), fmtDate(to));
      const counts = {};
      (Array.isArray(history) ? history : []).forEach(t => {
        if (t.category_id) {
          counts[t.category_id] = (counts[t.category_id] || 0) + 1;
        }
      });
      setUsageCounts(counts);
    } catch {
      // silent — usage counts are a nice-to-have
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this effect starts
    load();
    loadUsageCounts();
    // load/loadUsageCounts are recreated each render but only use these two (stable) API functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCategories, getTasksHistory]);

  const handleCreated = (newCat) => {
    setCategories(prev => [...prev, newCat]);
  };

  const handleUpdate = (updated) => {
    setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await deleteCategory(deleting.id);
      setCategories(prev => prev.filter(c => c.id !== deleting.id));
      setUsageCounts(prev => {
        const next = { ...prev };
        delete next[deleting.id];
        return next;
      });
      toast.success(`"${deleting.name}" deleted. Its tasks are now Uncategorized.`);
      setDeleting(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Sort: categories with tasks first, then alphabetical
  const sorted = useMemo(() => {
    return [...categories].sort((a, b) => {
      const ua = usageCounts[a.id] || 0;
      const ub = usageCounts[b.id] || 0;
      if (ua !== ub) return ub - ua;
      return a.name.localeCompare(b.name);
    });
  }, [categories, usageCounts]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Categories"
        description="Group your tasks by name and color so they are easier to find"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New category
          </Button>
        }
      />

      <Alert tone="neutral" title="Deleting is safe">
        If you delete a category, its tasks won't disappear — they'll just become "Uncategorized".
      </Alert>

      {error && !loading && <ErrorState title="Couldn't load your categories" message={error} onRetry={load} />}

      {loading && (
        <SkeletonGroup label="Loading categories…" className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <CategorySkeleton key={i} />)}
        </SkeletonGroup>
      )}

      {!loading && !error && (
        sorted.length > 0 ? (
          <div className="grid items-start gap-3 md:grid-cols-2">
            <AnimatePresence initial={false}>
              {sorted.map(cat => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  taskCount={usageCounts[cat.id] || 0}
                  onUpdate={handleUpdate}
                  onDelete={(id) => setCategories(prev => prev.filter(c => c.id !== id))}
                  onRequestDelete={setDeleting}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            icon={Tags}
            title="No categories yet"
            description='Categories help you group similar tasks together — like "Ibadah", "Work", or "Health".'
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create your first category
              </Button>
            }
          />
        )
      )}

      {/* Create modal */}
      <CategoryFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleting}
        onClose={() => !deleteLoading && setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        icon={Trash2}
        title={`Delete "${deleting?.name}"?`}
        message="This can't be undone — but don't worry, your tasks are safe."
        confirmLabel="Delete category"
        variant="danger"
      >
        {deleting && (usageCounts[deleting.id] || 0) > 0 && (
          <Alert tone="warning">
            <strong className="font-medium text-fg">{usageCounts[deleting.id]}</strong> task
            {usageCounts[deleting.id] === 1 ? '' : 's'} using this category will become{' '}
            <strong className="font-medium text-fg">Uncategorized</strong>. They won't be deleted.
          </Alert>
        )}
      </ConfirmModal>
    </div>
  );
}
