import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import Button from './Button';

/** [1, '…', 4, 5, 6, '…', 10] — always first, last, and a window around the current page. */
function pageItems(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) items.push('start-gap');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push('end-gap');
  items.push(total);
  return items;
}

/**
 * Previous / numbered pages / next. Renders nothing for a single page.
 * `compact` drops the page numbers for tight spots (inside a card).
 * Phones always get the compact "Page x of y" form.
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  compact = false,
  disabled = false,
  label = 'Pagination',
  className = '',
}) {
  if (totalPages <= 1) return null;

  const go = (p) => {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange(p);
  };

  return (
    <nav aria-label={label} className={cn('flex items-center justify-between gap-2', className)}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => go(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className={cn(compact ? 'sr-only' : 'hidden sm:inline')}>Previous</span>
      </Button>

      <span className={cn('text-xs font-medium tabular-nums text-muted', !compact && 'sm:hidden')} aria-live="polite">
        Page {page} of {totalPages}
      </span>

      {!compact && (
        <ul className="hidden items-center gap-1 sm:flex">
          {pageItems(page, totalPages).map((item) =>
            typeof item === 'string' ? (
              <li key={item} className="w-6 text-center text-sm text-subtle" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => go(item)}
                  disabled={disabled}
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    item === page
                      ? 'bg-primary text-on-primary shadow-[inset_0_1px_0_var(--edge-top),inset_0_-2px_0_var(--edge-bottom)]'
                      : 'text-muted hover:bg-sunken hover:text-fg'
                  )}
                >
                  {item}
                </button>
              </li>
            )
          )}
        </ul>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={() => go(page + 1)}
        disabled={disabled || page >= totalPages}
        aria-label="Next page"
      >
        <span className={cn(compact ? 'sr-only' : 'hidden sm:inline')}>Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
