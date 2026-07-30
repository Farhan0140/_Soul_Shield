import { useState, useEffect, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Plus, Tags, AlertCircle, Inbox, Info } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from '../components/Toast';
import CategoryCard from '../components/CategoryCard';
import CategoryFormModal from '../components/CategoryFormModal';
import ConfirmModal from '../components/ConfirmModal';
import Button from '../components/ui/Button';
import SkeletonCard from '../components/SkeletonCard';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } },
};
const child = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

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
      const fmt = (d) => d.toISOString().slice(0, 10);
      const history = await getTasksHistory(fmt(from), fmt(to));
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
    load();
    loadUsageCounts();
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
            <Tags className="w-7 h-7 text-indigo-500" />
            Categories
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Organize your tasks with colors and labels — makes them easier to find.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> New category
        </Button>
      </m.div>

      {/* Info banner */}
      <m.div
        variants={child}
        className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 border border-indigo-100"
      >
        <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-900">
          <p className="font-semibold mb-0.5">Deleting is safe</p>
          <p className="text-indigo-700">
            If you delete a category, its tasks won't disappear — they'll just become "Uncategorized".
          </p>
        </div>
      </m.div>

      {/* Error */}
      {error && (
        <m.div variants={child} className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm text-rose-700 mb-3">{error}</p>
          <Button variant="secondary" onClick={load}>Try again</Button>
        </m.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* List */}
      {!loading && !error && (
        <>
          {sorted.length > 0 ? (
            <m.div variants={child} className="grid gap-3 md:grid-cols-2">
              <AnimatePresence>
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
            </m.div>
          ) : (
            <m.div
              variants={child}
              className="text-center py-16 bg-white rounded-2xl border border-slate-200"
            >
              <m.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-4"
              >
                <Inbox className="w-8 h-8 text-indigo-500" />
              </m.div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">No categories yet</h3>
              <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
                Categories help you group similar tasks together — like "Ibadah", "Work", or "Health".
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" /> Create your first category
              </Button>
            </m.div>
          )}
        </>
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
        title={`Delete "${deleting?.name}"?`}
        message="This can't be undone — but don't worry, your tasks are safe."
        confirmLabel="Yes, delete it"
        variant="danger"
      >
        {deleting && (usageCounts[deleting.id] || 0) > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>{usageCounts[deleting.id]}</strong> task
              {usageCounts[deleting.id] === 1 ? '' : 's'} using this category will become{' '}
              <strong>Uncategorized</strong>. They won't be deleted.
            </p>
          </div>
        )}
      </ConfirmModal>
    </m.div>
  );
}