import { useId, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import Field from './Field';

const Textarea = forwardRef(function Textarea(
  { label, error, hint, id, rows = 3, className = '', required, optional, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = error || hint ? `${inputId}-msg` : undefined;

  return (
    <Field id={inputId} label={label} hint={hint} error={error} required={required} optional={optional} className={className}>
      <div className="field" data-invalid={!!error || undefined}>
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn('field-control resize-none px-3 py-2.5 leading-relaxed')}
          {...props}
        />
      </div>
    </Field>
  );
});

export default Textarea;
