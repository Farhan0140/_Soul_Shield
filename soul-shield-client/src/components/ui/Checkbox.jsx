import { useId, forwardRef } from 'react';
import { cn } from '../../utils/cn';

/**
 * Native checkbox with the design-system look.
 * - no label: just the box (caller supplies aria-label)
 * - label/description: an inline row
 * - `card`: the row sits in a bordered, clickable panel (settings-style toggle)
 */
const Checkbox = forwardRef(function Checkbox(
  { label, description, card = false, tone = 'default', className = '', id, children, ...props },
  ref
) {
  const generatedId = useId();
  const checkboxId = id || generatedId;

  if (!label) {
    return <input ref={ref} id={checkboxId} type="checkbox" className={cn('checkbox', className)} {...props} />;
  }

  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        'flex items-start gap-3',
        props.disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        card && 'rounded-xl border p-3.5 transition-colors',
        card && tone === 'default' && 'border-border bg-surface-2 hover:border-border-strong has-[:checked]:border-primary-ink/40 has-[:checked]:bg-primary-soft',
        card && tone === 'warning' && 'border-warning/30 bg-warning/5 hover:border-warning/50',
        className
      )}
    >
      <input ref={ref} id={checkboxId} type="checkbox" className="checkbox mt-0.5" {...props} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{description}</span>}
        {children}
      </span>
    </label>
  );
});

export default Checkbox;
