import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

const ALIGN = {
  start: 'left-0 origin-top-left',
  end: 'right-0 origin-top-right',
  // Left-aligned on phones (where the trigger usually wraps to the left
  // edge), right-aligned from `sm` up.
  responsive: 'left-0 origin-top-left sm:left-auto sm:right-0 sm:origin-top-right',
};

/**
 * Anchored dropdown panel. Closes on outside press, Escape (focus returns to
 * the trigger), or when content calls `close()`.
 *
 *   <Popover label="Date range" trigger={(props) => <Button {...props}>…</Button>}>
 *     {({ close }) => …}
 *   </Popover>
 */
export default function Popover({ trigger, children, label, align = 'start', className = '', panelClassName = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();

  // Handed to the panel content (e.g. a link that should close the menu).
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        'aria-expanded': open,
        'aria-controls': open ? panelId : undefined,
        'aria-haspopup': 'dialog',
      })}
      <AnimatePresence>
        {open && (
          <m.div
            id={panelId}
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'popover-surface absolute top-full z-40 mt-2 max-w-[calc(100vw-2rem)]',
              ALIGN[align] || ALIGN.start,
              panelClassName
            )}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
