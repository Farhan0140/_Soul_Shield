import { useState, useId } from 'react';
import { Check } from 'lucide-react';
import { FieldMessage } from './ui/Field';

function isValidHex(hex) {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(hex);
}

export default function ColorPicker({ value, onChange, label = 'Color' }) {
  const [hex, setHex] = useState(value || '#4F46E5');
  const [error, setError] = useState('');
  const id = useId();

  // Follow the controlled value when the parent changes it (adjusting state
  // during render, React's recommended alternative to a syncing effect).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) setHex(value);
  }

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
        <label htmlFor={`${id}-hex`} className="mb-1.5 block text-[13px] font-medium text-fg-2">{label}</label>
      )}

      <div className="flex items-center gap-2.5">
        {/* Native OS/browser color picker — any color can be chosen. */}
        <label
          className="relative block h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-border shadow-[inset_0_-2px_0_rgba(0,0,0,0.12),var(--elev-1)] transition-transform active:scale-95"
          title="Pick a color"
          style={{ backgroundColor: isValidHex(hex) ? hex : 'var(--sunken)' }}
        >
          <input
            type="color"
            value={isValidHex(hex) ? hex : '#4F46E5'}
            onChange={(e) => handleNativePick(e.target.value)}
            aria-label="Pick a color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="field relative h-11 flex-1" data-invalid={!!error || undefined}>
          <input
            id={`${id}-hex`}
            type="text"
            value={hex}
            onChange={(e) => handleHexChange(e.target.value)}
            maxLength={7}
            placeholder="#4F46E5"
            aria-label="Hex color code"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-msg` : undefined}
            className="field-control h-full px-3 font-mono uppercase"
          />
          {isValidHex(hex) && !error && (
            <Check className="absolute right-3 h-4 w-4 text-success" aria-hidden="true" />
          )}
        </div>
      </div>

      <FieldMessage id={`${id}-msg`} error={error} />
    </div>
  );
}
