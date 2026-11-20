import { createPortal } from 'react-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import Button from './ui/Button';

/** Floating bar for acting on selected rows. Portaled to <body> and lifted
 * above the mobile tab bar so it is never clipped or covered. */
export default function BulkActionBar({ count, onClear, onDeleteSelected }) {
  return createPortal(
    <AnimatePresence>
      {count > 0 && (
        <m.div
          role="region"
          aria-label="Bulk actions"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="popover-surface fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 p-2 pl-4 sm:inset-x-0 lg:bottom-6 lg:ml-[calc(50%+124px)] lg:-translate-x-1/2"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-fg">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-semibold tabular-nums text-on-primary">
              {count}
            </span>
            <span className="truncate">{count === 1 ? 'task selected' : 'tasks selected'}</span>
          </span>

          <Button variant="danger" size="sm" onClick={onDeleteSelected}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>

          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-fg"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
