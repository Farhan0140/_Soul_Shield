import { m, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { THEMES } from '../context/themes';

export default function ThemePicker() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const active = THEMES.find((t) => t.key === resolvedTheme) ?? THEMES[0];

  return (
    <div className="relative" ref={ref}>
      <m.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 bg-surface border-2 border-border rounded-xl
          hover:border-primary/40 hover:shadow-sm transition-all text-sm font-medium text-fg"
      >
        <span className="flex items-center -space-x-1">
          <span className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: active.bg }} />
          <span className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: active.primary }} />
        </span>
        <span>{active.label}</span>
        <m.div animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="w-4 h-4 text-muted" />
        </m.div>
      </m.button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-72 bg-surface rounded-2xl shadow-xl border border-border p-2 z-30 max-h-96 overflow-y-auto"
          >
            {THEMES.map((theme) => {
              const isActive = preference === theme.key;
              return (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => {
                    setPreference(theme.key);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg transition-colors text-left"
                >
                  <span className="flex items-center -space-x-1.5 flex-shrink-0">
                    <span className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: theme.bg }} />
                    <span className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: theme.primary }} />
                    <span className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: theme.success }} />
                  </span>
                  <span className="flex-1 text-sm font-medium text-fg">{theme.label}</span>
                  {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
