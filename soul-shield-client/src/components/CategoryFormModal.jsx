import { useState, useEffect } from 'react';
import { Tag } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from './Toast';
import ColorPicker from './ColorPicker';
import Input from './ui/Input';
import Button from './ui/Button';
import Modal, { ModalBody, ModalFooter } from './ui/Modal';

export default function CategoryFormModal({ open, onClose, onCreated }) {
  const { createCategory } = useApi();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form when the modal opens
      setName('');
      setColor('#4F46E5');
      setErrors({});
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
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

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New category"
      description="Group related tasks under a name and color."
      size="md"
    >
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-5">
          {/* Live preview */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3.5">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] shadow-[inset_0_-2px_0_rgba(0,0,0,0.14),var(--elev-1)] transition-colors"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            >
              <Tag className="h-4 w-4 text-white/90" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{name.trim() || 'Your category name'}</p>
              <p className="font-mono text-xs text-muted">{color}</p>
            </div>
          </div>

          <Input
            label="Category name"
            value={name}
            error={errors.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ibadah, Work, Health"
            data-autofocus
          />

          <ColorPicker value={color} onChange={setColor} />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create category
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
