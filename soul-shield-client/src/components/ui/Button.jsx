import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import Spinner from './Spinner';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  'danger-soft': 'btn-danger-soft',
};

const SPINNER_SIZE = { sm: 14, md: 16, lg: 18 };

/**
 * The one button used across the app.
 *
 * `loading` puts it into a busy state: it is disabled (so a second click can't
 * send a duplicate request), shows a spinner in place of its icons and sets
 * aria-busy. It returns to normal as soon as the caller clears `loading`.
 */
const Button = forwardRef(function Button(
  {
    children,
    loading = false,
    variant = 'primary', // primary | secondary | ghost | danger | danger-soft
    size = 'md', // sm | md | lg
    iconOnly = false,
    fullWidth = false,
    className = '',
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'btn',
        VARIANTS[variant] || VARIANTS.primary,
        `btn-${size}`,
        iconOnly && 'btn-icon',
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading && <Spinner size={SPINNER_SIZE[size]} />}
      {loading && iconOnly ? null : children}
    </button>
  );
});

export default Button;
