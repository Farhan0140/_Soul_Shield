import { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Palette, Check, AlertCircle } from 'lucide-react';

// A curated palette of accessible, pleasant colors
const PRESETS = [
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#EC4899', // pink
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#10B981', // emerald
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#0EA5E9', // sky
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#64748B', // slate
];

function isValidHex(hex) {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(hex);
}

export default function ColorPicker({ value, onChange, label = 'Color' }) {
  const [hex, setHex] = useState(value || '#4F46E5');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (value && value !== hex) setHex(value);
  }, [value]);

  const handleHexChange = (v) => {
    let clean = v.trim();
    if (!clean.startsWith('#')) clean = '#' + clean;
    setHex(clean);
    if (clean.length === 7) {
      if (isValidHex(clean)) {
        setError('');
        onChange(clean.toUpperCase());
      } else {
        setError("That doesn't look like a valid color code.");
      }
    } else if (clean.length > 1) {
      setError('');
    }
  };

  const selectPreset = (c) => {
    setHex(c);
    setError('');
    onChange(c);
  };

  return (
    <div>
      {label && (
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{label}</label>
      )}

      {/* Preview + hex input */}
      <div className="flex items-center gap-2 mb-3">
        <m.div
          key={hex}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="w-12 h-12 rounded-xl border-2 border-white shadow-md flex-shrink-0"
          style={{ backgroundColor: isValidHex(hex) ? hex : '#e2e8f0' }}
        />
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={hex}
            onChange={(e) => handleHexChange(e.target.value)}
            maxLength={7}
            placeholder="#4F46E5"
            className={`w-full px-3 py-2.5 rounded-xl border-2 font-mono text-sm uppercase outline-none transition-colors
              ${error ? 'border-rose-400' : 'border-slate-200 focus:border-indigo-500'}`}
          />
          {isValidHex(hex) && !error && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
          )}
        </div>
      </div>

      {/* Preset swatches */}
      <div className="grid grid-cols-8 gap-1.5">
        {PRESETS.map((c) => {
          const selected = hex.toUpperCase() === c.toUpperCase();
          return (
            <m.button
              key={c}
              type="button"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => selectPreset(c)}
              className={`relative aspect-square rounded-lg transition-shadow
                ${selected ? 'ring-2 ring-offset-2 ring-slate-800' : 'hover:ring-2 hover:ring-slate-300'}`}
              style={{ backgroundColor: c }}
              aria-label={`Select color ${c}`}
            >
              {selected && (
                <m.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Check className="w-4 h-4 text-white drop-shadow" strokeWidth={3} />
                </m.div>
              )}
            </m.button>
          );
        })}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <m.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex items-center gap-1 text-xs text-rose-500"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </m.p>
        )}
      </AnimatePresence>
    </div>
  );
}