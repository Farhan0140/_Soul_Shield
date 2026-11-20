import { useState, useId, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/cn';
import Field from './Field';

const HEIGHTS = { sm: 'h-9', md: 'h-10', lg: 'h-11' };

/** Text input with a label above, optional leading icon, hint and inline
 * error. Password inputs get a keyboard-accessible show/hide toggle. */
const Input = forwardRef(function Input(
  {
    label,
    type = 'text',
    error,
    hint,
    icon: Icon,
    trailing,
    size = 'lg',
    className = '',
    inputClassName = '',
    id,
    required,
    optional,
    labelAction,
    ...props
  },
  ref
) {
  const [showPwd, setShowPwd] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;
  const isPassword = type === 'password';
  const describedBy = error || hint ? `${inputId}-msg` : undefined;

  return (
    <Field id={inputId} label={label} hint={hint} error={error} required={required} optional={optional} labelAction={labelAction} className={className}>
      <div className={cn('field', HEIGHTS[size])} data-invalid={!!error || undefined} data-disabled={props.disabled || undefined}>
        {Icon && <Icon className="field-icon ml-3 h-4 w-4 shrink-0" aria-hidden="true" />}
        <input
          ref={ref}
          id={inputId}
          type={isPassword ? (showPwd ? 'text' : 'password') : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn('field-control h-full px-3', Icon && 'pl-2.5', inputClassName)}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
            aria-pressed={showPwd}
            className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-fg"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        {trailing}
      </div>
    </Field>
  );
});

export default Input;
