import { m, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

/** Label + control + hint/error wrapper shared by every form field.
 * The message element's id is `${id}-msg`; controls point aria-describedby
 * at it so screen readers read the hint or error with the field. */
export default function Field({ id, label, hint, error, required, optional, labelAction, className, children }) {
  return (
    <div className={cn('min-w-0', className)}>
      {(label || labelAction) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={id} className="block text-[13px] font-medium text-fg-2">
              {label}
              {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
              {optional && <span className="ml-1.5 font-normal text-subtle">Optional</span>}
            </label>
          )}
          {labelAction}
        </div>
      )}
      {children}
      <FieldMessage id={`${id}-msg`} error={error} hint={hint} />
    </div>
  );
}

export function FieldMessage({ id, error, hint }) {
  return (
    <>
      <AnimatePresence initial={false}>
        {error && (
          <m.p
            key="error"
            id={id}
            role="alert"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.16 }}
            className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-danger"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </m.p>
        )}
      </AnimatePresence>
      {!error && hint && (
        <p id={id} className="mt-1.5 text-[13px] leading-snug text-muted">
          {hint}
        </p>
      )}
    </>
  );
}
