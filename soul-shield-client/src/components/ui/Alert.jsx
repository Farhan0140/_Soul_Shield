import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

const TONES = {
  neutral: { icon: Info, box: 'border-border bg-surface-2', icon_cls: 'text-primary-ink' },
  info: { icon: Info, box: 'border-info/25 bg-info/[0.06]', icon_cls: 'text-info' },
  success: { icon: CheckCircle2, box: 'border-success/25 bg-success/[0.06]', icon_cls: 'text-success' },
  warning: { icon: AlertTriangle, box: 'border-warning/30 bg-warning/[0.07]', icon_cls: 'text-warning' },
  danger: { icon: AlertCircle, box: 'border-danger/25 bg-danger/[0.06]', icon_cls: 'text-danger' },
};

/** Inline message block. Body text stays in the neutral text colors for
 * contrast; the tone shows through the icon, border and tint. */
export default function Alert({ tone = 'neutral', title, children, icon, action, onDismiss, className = '', role }) {
  const t = TONES[tone] || TONES.neutral;
  const Icon = icon || t.icon;
  return (
    <div
      role={role || (tone === 'danger' ? 'alert' : 'status')}
      className={cn('flex gap-3 rounded-xl border px-3.5 py-3 text-sm', t.box, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.icon_cls)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold leading-snug text-fg">{title}</p>}
        {children && <div className={cn('leading-relaxed text-fg-2', title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
