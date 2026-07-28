import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, Check, X, Loader2, Tag } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import ColorPicker from './ColorPicker';
import Input from './ui/Input';

export default function CategoryCard({ category, taskCount, onUpdate, onDelete, onRequestDelete }) {
  const { updateCategory } = useApi();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color_hex);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const errs = {};
    if (!name.trim()) errs.name = "Categories need a name — what should we call this one?";
    else if (name.trim().length < 2) errs.name = "A bit longer please — at least 2 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    // Optimistic update
    const prev = { name: category.name, color_hex: category.color_hex };
    onUpdate({ ...category, name: name.trim(), color_hex: color });

    try {
      const updated = await updateCategory(category.id, name.trim(), color);
      onUpdate(updated);
      setEditing(false);
      // toast removed for inline edits to avoid spam — success is visible in UI
    } catch (err) {
      // Rollback
      onUpdate({ ...category, ...prev });
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(category.name);
    setColor(category.color_hex);
    setErrors({});
    setEditing(false);
  };

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all"
    >
      <div className="p-5">
        {editing ? (
          /* ---------- EDIT MODE ---------- */
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <m.div
                animate={{ backgroundColor: color }}
                className="w-12 h-12 rounded-xl shadow-md flex-shrink-0"
              />
              <div className="flex-1">
                <Input
                  label="Category name"
                  value={name}
                  error={errors.name || errors.form}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
              </div>
            </div>

            <ColorPicker value={color} onChange={setColor} />

            <div className="flex gap-2 pt-2">
              <m.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Cancel
              </m.button>
              <m.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSave}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-200 transition-shadow disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </m.button>
            </div>
          </m.div>
        ) : (
          /* ---------- VIEW MODE ---------- */
          <div className="flex items-start gap-4">
            {/* Color swatch */}
            <m.div
              whileHover={{ scale: 1.05, rotate: 3 }}
              className="w-14 h-14 rounded-xl shadow-md flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: category.color_hex }}
            >
              <Tag className="w-6 h-6 text-white/90" />
            </m.div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 text-lg truncate">{category.name}</h3>
              <div className="flex items-center gap-3 mt-1.5">
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold"
                  style={{
                    backgroundColor: `${category.color_hex}15`,
                    color: category.color_hex,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color_hex }} />
                  {category.color_hex}
                </span>
                <span className="text-xs text-slate-500">
                  {taskCount === 0
                    ? 'No tasks yet'
                    : `${taskCount} task${taskCount === 1 ? '' : 's'} using this`}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <m.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setEditing(true)}
                className="p-2 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                aria-label="Edit category"
              >
                <Edit2 className="w-4 h-4" />
              </m.button>
              <m.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onRequestDelete(category)}
                className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                aria-label="Delete category"
              >
                <Trash2 className="w-4 h-4" />
              </m.button>
            </div>
          </div>
        )}
      </div>
    </m.div>
  );
}