import { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle } from 'lucide-react';

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

  const handleNativePick = (c) => {
    const clean = c.toUpperCase();
    setHex(clean);
    setError('');
    onChange(clean);
  };

  return (
    <div>
      {label && (
        <label className="text-xs font-semibold text-muted mb-1.5 block">{label}</label>
      )}

      {/* Color picker trigger + hex input */}
      <div className="flex items-center gap-2 mb-3">
        <label
          className="relative w-12 h-12 rounded-xl border-2 border-white shadow-md flex-shrink-0 cursor-pointer overflow-hidden block"
          title="Pick a color"
        >
          <m.div
            key={hex}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="absolute inset-0"
            style={{ backgroundColor: isValidHex(hex) ? hex : '#e2e8f0' }}
          />
          {/* Native OS/browser color picker — replaces the old curated preset palette so any color can be chosen. */}
          <input
            type="color"
            value={isValidHex(hex) ? hex : '#4F46E5'}
            onChange={(e) => handleNativePick(e.target.value)}
            aria-label="Pick a color"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={hex}
            onChange={(e) => handleHexChange(e.target.value)}
            maxLength={7}
            placeholder="#4F46E5"
            aria-label="Hex color code"
            className={`w-full px-3 py-2.5 rounded-xl border-2 font-mono text-sm uppercase outline-none transition-colors
              ${error ? 'border-danger' : 'border-border focus:border-primary'}`}
          />
          {isValidHex(hex) && !error && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />
          )}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <m.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex items-center gap-1 text-xs text-danger"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </m.p>
        )}
      </AnimatePresence>
    </div>
  );
}