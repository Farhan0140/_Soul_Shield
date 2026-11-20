import { PartyPopper, Sparkles } from 'lucide-react';
import Modal, { ModalBody, ModalFooter } from './ui/Modal';
import Button from './ui/Button';

/** Celebration shown when a completion earns the task's reward message.
 * Rendered through the shared portal Modal, so it is never clipped by the
 * (animated) task card that opens it. */
export default function RewardModal({ open, text, taskTitle, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Deed complete"
      description={taskTitle ? `You completed “${taskTitle}”.` : undefined}
      icon={PartyPopper}
      iconTone="accent"
      size="sm"
    >
      <ModalBody>
        <div className="flex items-start gap-2.5 rounded-xl border border-primary-ink/15 bg-primary-soft px-4 py-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
          <p className="text-sm font-medium leading-relaxed text-fg">{text}</p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>Continue</Button>
      </ModalFooter>
    </Modal>
  );
}
