import { useState, useEffect } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import { useApi } from '../context/ApiContext';
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

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Delete your account?"
      description="This permanently removes your account and everything in it."
      icon={Trash2}
      iconTone="danger"
      size="md"
    >
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          <Alert tone="danger" role="note">
            This permanently deletes <strong className="font-medium text-fg">{user?.email}</strong> and everything in it: tasks,
            sub-tasks, categories, completion history and Quran bookmarks, on every device.
            <strong className="font-medium text-fg"> This can&apos;t be undone.</strong>
          </Alert>

          <Input
            label="Your password" type="password" icon={Lock}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-autofocus
          />
          <Input
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            hint={confirmText && confirmText !== CONFIRM_WORD ? `Type ${CONFIRM_WORD} in capital letters.` : undefined}
            inputClassName="font-mono tracking-wider"
          />
          {error && <Alert tone="danger">{error}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={loading} disabled={!canSubmit}>
            Delete forever
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
