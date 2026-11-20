import { cn } from '../../utils/cn';

const TONES = {
  neutral: 'bg-sunken text-fg-2 border-border',
  primary: 'bg-primary-soft text-primary-ink border-primary-ink/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-info/10 text-info border-info/20',
};

const DOT = {
  neutral: 'bg-muted',
  primary: 'bg-primary-ink',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

/** Small status/label pill. `color` renders a custom-colored dot (categories). */
export default function Badge({ tone = 'neutral', icon: Icon, dot = false, color, children, className = '', title }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[22px] max-w-full items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold leading-none whitespace-nowrap',
        TONES[tone],
        className
      )}
    >
      {color ? (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      ) : dot ? (
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[tone])} aria-hidden="true" />
      ) : null}
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  );
}
