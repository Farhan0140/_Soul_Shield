import { createContext, useContext, useState, useCallback } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  const toast = {
    success: (m) => push(m, 'success'),
    error:   (m) => push(m, 'error', 6000),
    info:    (m) => push(m, 'info'),
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    error:   <AlertCircle className="w-5 h-5 text-rose-500" />,
    info:    <Info className="w-5 h-5 text-indigo-500" />,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-100 space-y-2 w-80">
        <AnimatePresence>
          {toasts.map(t => (
            <m.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className="bg-white rounded-xl shadow-lg border border-slate-200 p-3 flex items-start gap-3"
            >
              {icons[t.type]}
              <p className="text-sm text-slate-700 flex-1">{t.message}</p>
              <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}>
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);