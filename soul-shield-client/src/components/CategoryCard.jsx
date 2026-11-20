import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, Check, Tag } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import ColorPicker from './ColorPicker';
import Input from './ui/Input';
import Button from './ui/Button';
import Alert from './ui/Alert';
import Tooltip from './ui/Tooltip';

export default function CategoryCard({ category, taskCount, onUpdate, onRequestDelete }) {
  const { updateCategory } = useApi();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color_hex);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (loading) return;
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
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="card p-4 sm:p-5"
    >
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          /* ---------- EDIT MODE ---------- */
          <m.form
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            noValidate
            className="space-y-4"
          >
            {errors.form && <Alert tone="danger">{errors.form}</Alert>}
            <Input
              label="Category name"
              size="md"
              value={name}
              error={errors.name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
              autoFocus
            />

            <ColorPicker value={color} onChange={setColor} />

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={loading}>
                <Check className="h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </m.form>
        ) : (
          /* ---------- VIEW MODE ---------- */
          <m.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-4"
          >
            {/* Color swatch */}
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_0_rgba(0,0,0,0.16),var(--elev-1)]"
              style={{ backgroundColor: category.color_hex }}
              aria-hidden="true"
            >
              <Tag className="h-5 w-5 text-white/90" />
            </span>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-medium text-fg">{category.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color_hex }} aria-hidden="true" />
                  {category.color_hex}
                </span>
                <span>
                  {taskCount === 0
                    ? 'No tasks yet'
                    : `${taskCount} task${taskCount === 1 ? '' : 's'} using this`}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip label="Edit">
                <Button variant="ghost" size="sm" iconOnly onClick={() => setEditing(true)} aria-label={`Edit ${category.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip label="Delete" align="end">
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => onRequestDelete(category)}
                  aria-label={`Delete ${category.name}`}
                  className="hover:!bg-danger/10 hover:!text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Tooltip>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
