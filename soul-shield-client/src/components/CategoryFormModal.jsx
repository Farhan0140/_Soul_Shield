import { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import ColorPicker from './ColorPicker';
import Input from './ui/Input';
import Button from './ui/Button';

export default function CategoryFormModal({ open, onClose, onCreated }) {
  const { createCategory } = useApi();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setColor('#4F46E5');
      setErrors({});
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = "Every category needs a name — what's this one about?";
    else if (name.trim().length < 2) errs.name = "A bit longer please — at least 2 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const created = await createCategory(name.trim(), color);
      toast.success(`Category "${created.name}" created ✨`);
      onCreated(created);
      onClose();
    } catch (err) {
      // "already exists" → friendly message from api.js
      setErrors({ name: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <m.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">New category</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Live preview */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <m.div
                  animate={{ backgroundColor: color }}
                  className="w-12 h-12 rounded-xl shadow-md flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {name.trim() || 'Your category name'}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{color}</p>
                </div>
              </div>

              <Input
                label="Category name"
                value={name}
                error={errors.name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />

              <ColorPicker value={color} onChange={setColor} />

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" loading={loading} className="flex-1">
                  Create category
                </Button>
              </div>
            </form>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}