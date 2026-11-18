import { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Lock, Trash2, AlertTriangle } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import Input from './ui/Input';
import Button from './ui/Button';

// 4xx bodies carry a specific reason ("Your current password is incorrect");
// show it. For anything else, keep the friendly generic message.
const clientErrorMessage = (err) =>
  (err.status >= 400 && err.status < 500 && err.raw?.error) || err.message;

const CONFIRM_WORD = 'DELETE';

/**
 * Permanently deletes the signed-in account (DELETE /users/me). Requires the
 * password plus typing DELETE, since it can't be undone.
 */
export default function DeleteAccountModal({ open, onClose }) {
  const { user, logout } = useAuth();
  const { deleteAccount } = useApi();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset the form each time the modal opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPassword('');
    setConfirmText('');
    setError('');
  }, [open]);

  const canSubmit = password.length > 0 && confirmText === CONFIRM_WORD && !loading;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await deleteAccount(password);
      onClose();
      logout();
      toast.success('Your account has been deleted.');
    } catch (err) {
      setError(clientErrorMessage(err));
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-surface rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-danger" />
                </div>
                <h2 id="delete-account-title" className="text-lg font-bold text-fg">Delete your account?</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-bg transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/5 border border-danger/20">
                <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <p className="text-xs text-fg">
                  This permanently deletes <strong>{user?.email}</strong> and everything in it: tasks,
                  sub-tasks, categories, completion history and Quran bookmarks, on every device.
                  <strong> This can&apos;t be undone.</strong>
                </p>
              </div>

              <Input
                label="Your password" type="password" icon={Lock}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <Input
                label={`Type ${CONFIRM_WORD} to confirm`}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" variant="danger" loading={loading} disabled={!canSubmit} className="flex-1">
                  Delete forever
                </Button>
              </div>
            </form>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
