import { m, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../utils/cn';
import Spinner from './ui/Spinner';

/** Completion toggle for tasks and sub-tasks: raised box that fills with the
 * accent and a check when done, and shows a spinner while the request runs. */
export default function TaskCheck({ checked, pending, disabled, onClick, label, size = 'md' }) {
  const box = size === 'sm' ? 'h-[18px] w-[18px] rounded-[5px]' : 'h-[22px] w-[22px] rounded-md';
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      aria-label={label}
      aria-pressed={checked}
      aria-busy={pending || undefined}
      className={cn(
        'mt-px inline-flex shrink-0 items-center justify-center border-[1.5px] transition-[background-color,border-color,transform] duration-150 active:scale-90 disabled:cursor-not-allowed',
        box,
        checked
          ? 'border-[color-mix(in_srgb,var(--on-primary)_25%,var(--primary))] bg-primary text-on-primary shadow-[inset_0_1px_0_var(--edge-top),inset_0_-1px_0_var(--edge-bottom)]'
          : 'border-border-strong bg-surface shadow-[inset_0_1px_1px_rgba(17,18,20,0.06)] enabled:hover:border-primary-ink',
        disabled && !pending && 'opacity-60'
      )}
    >
      {pending ? (
        <Spinner size={size === 'sm' ? 11 : 13} className={checked ? 'text-on-primary' : 'text-primary-ink'} />
      ) : (
        <AnimatePresence initial={false}>
          {checked && (
            <m.span
              key="check"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="inline-flex"
            >
              <Check className={icon} strokeWidth={3} />
            </m.span>
          )}
        </AnimatePresence>
      )}
    </button>
  );
}
