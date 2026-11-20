import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../utils/cn';

const ToastContext = createContext(null);

const TYPES = {
  success: { icon: CheckCircle2, tone: 'text-success bg-success/10', label: 'Success' },
  error: { icon: AlertCircle, tone: 'text-danger bg-danger/10', label: 'Error' },
  warning: { icon: AlertTriangle, tone: 'text-warning bg-warning/10', label: 'Warning' },
  info: { icon: Info, tone: 'text-primary-ink bg-primary-soft', label: 'Notice' },
};

const MAX_VISIBLE = 4;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const push = useCallback((message, type = 'info', duration = 4000) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { id, message, type }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
  }, [dismiss]);

  // Same API as before: toast.success(msg) / toast.error(msg) / toast.info(msg).
  const toast = useMemo(() => ({
    success: (msg) => push(msg, 'success'),
    error: (msg) => push(msg, 'error', 6000),
    warning: (msg) => push(msg, 'warning', 5000),
    info: (msg) => push(msg, 'info'),
  }), [push]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div
          className={cn(
            'pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]',
            'sm:inset-x-auto sm:top-auto sm:right-0 sm:bottom-0 sm:items-end sm:p-5'
          )}
        >
          <AnimatePresence initial={false}>
            {toasts.map((t) => {
              const cfg = TYPES[t.type] || TYPES.info;
              const Icon = cfg.icon;
              return (
                <m.div
                  key={t.id}
                  layout
                  role={t.type === 'error' ? 'alert' : 'status'}
                  aria-live={t.type === 'error' ? 'assertive' : 'polite'}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.14 } }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="popover-surface pointer-events-auto flex w-full max-w-sm items-start gap-3 p-3 pr-2"
                >
                  <span className={cn('mt-px inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', cfg.tone)}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="min-w-0 flex-1 pt-1 text-sm leading-snug text-fg">
                    <span className="sr-only">{cfg.label}: </span>
                    {t.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss notification"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-fg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </m.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- the provider's hook lives beside it
export const useToast = () => useContext(ToastContext);
