import { m, AnimatePresence } from 'framer-motion';
import { PartyPopper, X } from 'lucide-react';

export default function RewardModal({ open, text, taskTitle, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <m.div
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-surface rounded-3xl shadow-2xl p-7 text-center overflow-hidden"
          >
            {/* Decorative gradient glow */}
            <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-gradient-to-br from-amber-200 via-yellow-100 to-transparent opacity-70 blur-2xl" />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted hover:text-fg hover:bg-bg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <m.div
              initial={{ scale: 0.5, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
              className="relative mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-200"
            >
              <PartyPopper className="w-8 h-8 text-white" />
            </m.div>

            <h2 className="relative mt-4 text-lg font-bold text-fg">Well done!</h2>
            {taskTitle && (
              <p className="relative mt-0.5 text-xs font-medium text-muted uppercase tracking-wide">
                {taskTitle}
              </p>
            )}

            <p className="relative mt-3 text-sm font-medium text-warning bg-gradient-to-r from-amber-50 to-yellow-50 border border-warning/20 rounded-xl px-4 py-3">
              {text}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="relative mt-5 w-full py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-indigo-200 transition-shadow"
            >
              Nice!
            </button>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
