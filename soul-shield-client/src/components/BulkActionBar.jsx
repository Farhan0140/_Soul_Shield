import { m, AnimatePresence } from 'framer-motion';
import { CheckSquare, Trash2, X } from 'lucide-react';
import Button from './ui/Button';

export default function BulkActionBar({ count, onClear, onDeleteSelected }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <m.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold">
              {count}
            </div>
            <span className="text-sm font-medium">
              {count === 1 ? 'task selected' : 'tasks selected'}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          <Button
            variant="danger"
            onClick={onDeleteSelected}
            className="!py-2 !px-3 !bg-rose-500 hover:!bg-rose-600"
          >
            <Trash2 className="w-4 h-4" /> Delete selected
          </Button>

          <button
            onClick={onClear}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}