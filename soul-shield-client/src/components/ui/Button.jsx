import { m } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  loading = false,
  variant = 'primary', // primary | secondary | ghost | danger
  className = '',
  disabled,
  ...props
}) {
  const variants = {
    primary:   'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-200 hover:scale-[1.02]',
    secondary: 'bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600',
    ghost:     'bg-transparent text-slate-600 hover:bg-slate-100',
    danger:    'bg-rose-500 text-white hover:bg-rose-600 hover:shadow-lg hover:shadow-rose-200',
  };

  return (
    <m.button
      whileTap={{ scale: 0.97 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </m.button>
  );
}