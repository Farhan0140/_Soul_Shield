import { m, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import Button from './ui/Button';

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // danger | primary
  icon = AlertTriangle,
  loading = false,
  children, // extra content (e.g., warning details)
}) {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <m.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center
                  ${variant === 'danger' ? 'bg-rose-100' : 'bg-indigo-100'}`}>
                  {(() => {
                    const Icon = icon;
                    return <Icon className={`w-6 h-6 ${variant === 'danger' ? 'text-rose-600' : 'text-indigo-600'}`} />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{message}</p>
                  {children && <div className="mt-3">{children}</div>}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors -mr-1 -mt-1"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1"
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  variant={variant}
                  onClick={onConfirm}
                  loading={loading}
                  className="flex-1"
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}