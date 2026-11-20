import { useId } from 'react';
import { m } from 'framer-motion';
import { cn } from '../../utils/cn';

const SIZES = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-9 px-3.5 text-sm',
};

/**
 * Single-choice control (filters, tabs, type pickers). Radio-group semantics:
 * one tab stop, arrow keys move and select, like native radios.
 * options: [{ value, label, icon?, count? }]
 */
export default function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  ariaLabel,
  className = '',
}) {
  const groupId = useId();

  const handleKeyDown = (e, index) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const next = (index + keys[e.key] + options.length) % options.length;
    onChange(options[next].value);
    const buttons = e.currentTarget.parentElement?.querySelectorAll('[role="radio"]');
    buttons?.[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'gap-0.5 rounded-[10px] border border-border bg-sunken p-[3px]',
        fullWidth ? 'flex w-full' : 'inline-flex max-w-full overflow-x-auto',
        className
      )}
    >
      {options.map((opt, index) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[7px] font-medium whitespace-nowrap transition-colors',
              fullWidth && 'flex-1',
              SIZES[size],
              active ? 'text-fg' : 'text-muted hover:text-fg'
            )}
          >
            {active && (
              <m.span
                layoutId={`seg-thumb-${groupId}`}
                className="absolute inset-0 rounded-[7px] border border-border bg-surface shadow-[inset_0_-1px_0_var(--edge-bottom),var(--elev-1)]"
                transition={{ type: 'spring', stiffness: 520, damping: 42 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
              {opt.label}
              {opt.count != null && (
                <span className={cn('tabular-nums text-[11px]', active ? 'text-muted' : 'text-subtle')}>{opt.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
