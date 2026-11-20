import { cn } from '../../utils/cn';

/** Lightweight hover/focus tooltip (pure CSS, see .tooltip in index.css).
 * It is visual only: the wrapped control must carry its own aria-label.
 * `align="end"` anchors it to the right edge, for controls near the screen edge. */
export default function Tooltip({ label, align = 'center', children, className = '' }) {
  return (
    <span className={cn('tooltip-host', className)}>
      {children}
      <span aria-hidden="true" className={cn('tooltip', align === 'end' && 'tooltip-end')}>
        {label}
      </span>
    </span>
  );
}
