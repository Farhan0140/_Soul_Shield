import { AlertTriangle } from 'lucide-react';
import Modal, { ModalBody, ModalFooter } from './ui/Modal';
import Button from './ui/Button';

/** Yes/no confirmation built on the shared Modal. While `loading`, the
 * confirm button shows a spinner and both buttons are locked so the action
 * can't be sent twice (callers also ignore onClose until it finishes). */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // danger | primary
  icon = AlertTriangle,
  loading = false,
  children, // extra content (e.g., warning details)
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      icon={icon}
      iconTone={variant === 'danger' ? 'danger' : 'accent'}
      size="md"
    >
      {children && <ModalBody>{children}</ModalBody>}
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
