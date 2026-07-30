import { useState, useId, forwardRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

const Input = forwardRef(function Input(
  { label, type = 'text', error, icon: Icon, className = '', id, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;
  const isPassword = type === 'password';
  const active = focused || String(props.value || props.defaultValue || '').length > 0;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`relative flex items-center rounded-xl border-2 transition-all duration-200 bg-white
          ${error ? 'border-rose-400 focus-within:border-rose-500' : ''}
          ${!error && focused ? 'border-indigo-500 shadow-sm shadow-indigo-100' : ''}
          ${!error && !focused ? 'border-slate-200 hover:border-slate-300' : ''}
        `}
      >
        {Icon && (
          <Icon
            className={`w-5 h-5 ml-3 transition-colors ${
              error ? 'text-rose-400' : focused ? 'text-indigo-500' : 'text-slate-400'
            }`}
          />
        )}
        <input
          ref={ref}
          id={inputId}
          type={isPassword ? (showPwd ? 'text' : 'password') : type}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          className="w-full px-3 py-3.5 bg-transparent outline-none text-slate-800 placeholder-transparent"
          placeholder={label}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPwd(s => !s)}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
            className="px-3 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
          >
            {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Floating label */}
      <label
        htmlFor={inputId}
        className={`absolute left-3 pointer-events-none transition-all duration-200 px-1
          ${Icon ? 'left-10' : 'left-3'}
          ${active ? 'top-0 text-xs bg-white text-indigo-600' : 'top-3.5 text-sm text-slate-400'}
          ${error ? (active ? 'text-rose-500' : 'text-rose-400') : ''}
        `}
      >
        {label}
      </label>

      {/* Error message with slide-in */}
      <AnimatePresence>
        {error && (
          <m.p
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="mt-1.5 flex items-center gap-1 text-xs text-rose-500"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </m.p>
        )}
      </AnimatePresence>
    </div>
  );
});

export default Input;