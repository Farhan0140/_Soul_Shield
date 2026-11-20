import { useState, useEffect } from 'react';
import { Lock, KeyRound } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { setToken } from '../services/api';
import { validateNewPassword } from '../utils/validation';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import Input from './ui/Input';
import Button from './ui/Button';
import Alert from './ui/Alert';
import Modal, { ModalBody, ModalFooter } from './ui/Modal';


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
    if (loading) return;
    const invalid = validate();
    if (invalid) return setErrors(invalid);

    setErrors({});
    setLoading(true);
    try {
      const { token } = await changePassword(form.current, form.next);
      // Changing the password revokes every existing session, this one
      // included; the response carries this device's replacement token.
      if (token) setToken(token);
      toast.success("Password updated, other devices are signed out");
      onClose();
    } catch (err) {
      const msg = clientErrorMessage(err);
      if (/current password/i.test(msg)) setErrors({ current: msg });
      else setErrors({ form: msg });
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
      title="Change your password"
      description={`For ${user?.email ?? 'your account'}. Other devices will be signed out.`}
      icon={KeyRound}
      size="md"
    >
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <Input
            label="Current password" type="password" icon={Lock}
            autoComplete="current-password"
            value={form.current} error={errors.current}
            onChange={setField('current')}
            data-autofocus
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
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Update password
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
