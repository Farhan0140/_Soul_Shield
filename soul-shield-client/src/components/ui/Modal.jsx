import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence, useIsPresent } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

/* ---------------------------------------------------------------------------
   Global overlay bookkeeping, shared by every open dialog:
   - `stack`: open dialog ids, top-most last. Only the top one reacts to
     Escape / Tab, so nested dialogs close one at a time.
   - scroll lock: reference-counted, so closing an inner dialog doesn't
     unlock the page while an outer one is still open.
   ------------------------------------------------------------------------- */
const stack = [];
let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function lockScroll() {
  if (lockCount++ > 0) return;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  savedOverflow = document.body.style.overflow;
  savedPaddingRight = document.body.style.paddingRight;
  document.body.style.overflow = 'hidden';
  // Reserve the scrollbar's width so the page behind doesn't shift sideways.
  if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
}

function unlockScroll() {
  if (--lockCount > 0) return;
  lockCount = 0;
  document.body.style.overflow = savedOverflow;
  document.body.style.paddingRight = savedPaddingRight;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
};

/**
 * Accessible dialog rendered through a portal into <body>, so it always sits
 * above the whole app and is never clipped or trapped by a parent's
 * transform/overflow/z-index.
 *
 * Closing: the X button, Escape, and a click on the backdrop all call
 * `onClose` (pass `closeOnBackdrop={false}` to keep the backdrop inert).
 * Callers that are mid-request simply ignore onClose until they finish.
 *
 * Phones get a bottom sheet; larger screens get a centered panel.
 * Compose content with <ModalBody> and <ModalFooter>.
 */
export default function Modal({ open, ...props }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>{open && <ModalPanel key="modal" {...props} />}</AnimatePresence>,
    document.body
  );
}

function ModalPanel({
  onClose,
  title,
  description,
  icon: Icon,
  iconTone = 'neutral', // neutral | accent | danger | warning
  size = 'md',
  closeOnBackdrop = true,
  hideCloseButton = false,
  ariaLabel,
  className = '',
  children,
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const panelRef = useRef(null);
  const pressStartedOnBackdrop = useRef(false);
  const isPresent = useIsPresent();

  // Latest callbacks/flags for the document-level listeners below, which are
  // registered once per mount.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    stack.push(id);
    lockScroll();

    // Initial focus: keep an autoFocus'd field, else the first control in the
    // body, else the dialog itself (so screen readers announce its title).
    const panel = panelRef.current;
    const frame = requestAnimationFrame(() => {
      if (!panel || panel.contains(document.activeElement)) return;
      const target =
        panel.querySelector('[data-modal-body] [data-autofocus]') ||
        panel.querySelector(`[data-modal-body] :is(${FOCUSABLE})`) ||
        panel;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (e) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Capture phase: runs before React's own listeners, which stop propagation
    // at the portal root (see the onKeyDown below).
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      const index = stack.lastIndexOf(id);
      if (index >= 0) stack.splice(index, 1);
      unlockScroll();
      // Hand focus back to whatever opened the dialog.
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [id]);

  const iconToneClass = {
    neutral: 'icon-tile',
    accent: 'icon-tile icon-tile-accent',
    danger: 'icon-tile text-danger',
    warning: 'icon-tile text-warning',
  }[iconTone];

  return (
    <div
      className={cn('fixed inset-0 z-[100]', !isPresent && 'pointer-events-none')}
      // The portal still bubbles React events to the component that rendered
      // it; stop them here so a click in a dialog can never trigger a handler
      // on the card or page behind it.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <m.div
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--overlay)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />
      <div
        className="absolute inset-0 flex items-end justify-center overflow-y-auto sm:items-center sm:p-6"
        onMouseDown={(e) => {
          pressStartedOnBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          // Only a press that both starts and ends on the backdrop closes —
          // dragging a text selection out of the dialog must not.
          if (closeOnBackdrop && pressStartedOnBackdrop.current && e.target === e.currentTarget) {
            onCloseRef.current?.();
          }
          pressStartedOnBackdrop.current = false;
        }}
      >
        <m.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : ariaLabel}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          initial={{ opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.985 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'dialog-surface relative flex w-full flex-col overflow-hidden outline-none',
            'max-h-[calc(100dvh-0.75rem)] rounded-t-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl',
            SIZES[size] || SIZES.md,
            className
          )}
        >
          {/* Grab handle: a visual cue that this is a sheet on phones. */}
          <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden="true" />

          {(title || !hideCloseButton) && (
            <div className={cn('flex shrink-0 items-start gap-3 px-5 pt-4 sm:px-6 sm:pt-5', title ? 'pb-4' : 'pb-0')}>
              {Icon && title && (
                <div className={cn(iconToneClass, 'h-10 w-10')}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                {title && (
                  <h2 id={titleId} className="text-base font-semibold leading-snug sm:text-[17px]">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-sm leading-relaxed text-muted">
                    {description}
                  </p>
                )}
              </div>
              {!hideCloseButton && (
                <button
                  type="button"
                  onClick={() => onCloseRef.current?.()}
                  aria-label="Close dialog"
                  className="-mr-1.5 -mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-[background-color,color,transform] duration-150 hover:bg-sunken hover:text-fg active:scale-95 active:bg-border"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>
          )}

          {children}
        </m.div>
      </div>
    </div>
  );
}

/** Scrollable dialog content. */
export function ModalBody({ className = '', children }) {
  return (
    <div data-modal-body className={cn('min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6', className)}>
      {children}
    </div>
  );
}

/** Action row pinned to the bottom. Buttons stack (primary on top) on phones. */
export function ModalFooter({ className = '', children }) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-surface-2 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6',
        'pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-3.5',
        '[&>.btn]:w-full sm:[&>.btn]:w-auto',
        className
      )}
    >
      {children}
    </div>
  );
}
