import { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Lock, KeyRound, ArrowRight } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { setToken } from '../services/api';
import { validateNewPassword } from '../utils/validation';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import Input from './ui/Input';
import Button from './ui/Button';


// 4xx bodies carry a specific reason ("Your current password is incorrect");
// show it. For anything else, keep the friendly generic message.
const clientErrorMessage = (err) =>
  (err.status >= 400 && err.status < 500 && err.raw?.error) || err.message;

const EMPTY_FORM = { current: '', next: '', confirm: '' };

/**
 * Change password while signed in: POST /users/change-password with the
 * current password + the new one. (The old version of this modal called the
 * forgot-password endpoint with the email as the "reset token", so it always
 * failed.)
 */
export default function ChangePasswordModal({ open, onClose }) {
  const { user } = useAuth();
  const { changePassword } = useApi();
  const toast = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset the form each time the modal opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(EMPTY_FORM);
    setErrors({});
  }, [open]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    if (!form.current) return { current: 'Please enter your current password.' };
    const passwordError = validateNewPassword(form.next);
    if (passwordError) return { next: passwordError };
    if (form.next === form.current) return { next: 'Choose something different from your current password.' };
    if (form.next !== form.confirm) return { confirm: "The passwords don't match." };
    return null;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const invalid = validate();
    if (invalid) return setErrors(invalid);

    setErrors({});
    setLoading(true);
    try {
      const { token } = await changePassword(form.current, form.next);
      // Changing the password revokes every existing session, this one
      // included; the response carries this device's replacement token.
      if (token) setToken(token);
      toast.success("Password updated! Other devices have been signed out.");
      onClose();
    } catch (err) {
      const msg = clientErrorMessage(err);
      if (/current password/i.test(msg)) setErrors({ current: msg });
      else setErrors({ form: msg });
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-surface rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              <div>
                <h2 id="change-password-title" className="text-lg font-bold text-fg">Change your password</h2>
                <p className="text-xs text-muted mt-0.5">For {user?.email}</p>
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
              <Input
                label="Current password" type="password" icon={Lock}
                autoComplete="current-password"
                value={form.current} error={errors.current}
                onChange={setField('current')}
                autoFocus
              />
              <Input
                label="New password" type="password" icon={KeyRound}
                autoComplete="new-password"
                value={form.next} error={errors.next}
                onChange={setField('next')}
              />
              <Input
                label="Confirm new password" type="password" icon={KeyRound}
                autoComplete="new-password"
                value={form.confirm} error={errors.confirm}
                onChange={setField('confirm')}
              />
              {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
              <Button type="submit" loading={loading} className="w-full">
                Update password <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
