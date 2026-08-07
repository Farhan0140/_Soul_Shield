import { m } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const variants = {
  primary:   'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-200 hover:scale-[1.02]',
  secondary: 'bg-surface border-2 border-border text-fg hover:border-primary hover:text-primary',
  ghost:     'bg-transparent text-muted hover:bg-bg',
  danger:    'bg-danger text-white hover:bg-danger/90 hover:shadow-lg hover:shadow-rose-200',
};

export default function Button({
  children,
  loading = false,
  variant = 'primary', // primary | secondary | ghost | danger
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <m.button
      type={type}
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