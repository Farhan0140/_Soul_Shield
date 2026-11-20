import { Inbox, CloudOff, RotateCcw } from 'lucide-react';
import { cn } from '../../utils/cn';
import Button from './Button';

/** "Nothing here yet" block. `bordered` draws it as a dashed card. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, bordered = true, className = '' }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center px-6 py-12 text-center sm:py-14',
        bordered && 'rounded-2xl border border-dashed border-border-strong bg-surface-2',
        className
      )}
    >
      <div className="icon-tile mb-4 h-11 w-11">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-[15px] font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A failed load, explained, with a retry button when one makes sense. */
export function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  retrying = false,
  className = '',
}) {
  return (
    <div role="alert" className={cn('card flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="icon-tile mb-4 h-11 w-11 text-danger">
        <CloudOff className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-[15px] font-medium">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry} loading={retrying} className="mt-5">
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
      )}
    </div>
  );
}
