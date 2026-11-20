import { useId, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import Field from './Field';

const HEIGHTS = { sm: 'h-9', md: 'h-10', lg: 'h-11' };

/** Native <select> (best keyboard + mobile behavior) styled like the inputs. */
const Select = forwardRef(function Select(
  { label, error, hint, id, size = 'lg', icon: Icon, className = '', children, ...props },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const describedBy = error || hint ? `${selectId}-msg` : undefined;

  return (
    <Field id={selectId} label={label} hint={hint} error={error} className={className}>
      <div className={cn('field relative', HEIGHTS[size])} data-invalid={!!error || undefined}>
        {Icon && <Icon className="field-icon pointer-events-none ml-3 h-4 w-4 shrink-0" aria-hidden="true" />}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn('field-control h-full appearance-none bg-transparent pr-9', Icon ? 'pl-2.5' : 'pl-3')}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" aria-hidden="true" />
      </div>
    </Field>
  );
});

export default Select;
