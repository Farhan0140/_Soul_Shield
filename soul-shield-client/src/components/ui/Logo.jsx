import { cn } from '../../utils/cn';

/** Flat rendering of the app icon: an emerald shield holding a brass crescent
 * and a thin spire of light. Colors come from tokens so it follows the theme. */
export function LogoMark({ size = 28, className = '' }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <path
        d="M16 2.5 27.5 6.4v8.4c0 6.7-4.6 12.1-11.5 14.7C9.1 26.9 4.5 21.5 4.5 14.8V6.4L16 2.5Z"
        fill="var(--primary)"
      />
      <path
        d="M16 5.3 25 8.3v6.5c0 5.3-3.5 9.6-9 11.8-5.5-2.2-9-6.5-9-11.8V8.3l9-3Z"
        fill="none"
        stroke="var(--brass)"
        strokeOpacity="0.55"
        strokeWidth="0.9"
      />
      <path
        d="M17.9 7.6a5 5 0 1 0 4 6.3 4 4 0 1 1-4-6.3Z"
        fill="var(--brass)"
      />
      <path d="M15.4 24.2 16 15.4l.6 8.8Z" fill="var(--brass)" />
    </svg>
  );
}

/** Brand mark + optional wordmark. */
export default function Logo({ size = 'md', showWordmark = true, className = '', wordmarkClassName = 'text-fg' }) {
  const px = size === 'lg' ? 36 : size === 'sm' ? 26 : 28;
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={px} />
      {showWordmark && (
        <span className={cn('font-medium', wordmarkClassName, size === 'lg' ? 'text-lg' : 'text-base')}>
          SoulShield
        </span>
      )}
    </span>
  );
}
