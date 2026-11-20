import { ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/cn';

/** Brand mark (raised lemon tile) + optional wordmark. */
export default function Logo({ size = 'md', showWordmark = true, className = '', wordmarkClassName = 'text-fg' }) {
  const tile = size === 'lg' ? 'h-10 w-10 rounded-xl' : size === 'sm' ? 'h-7 w-7 rounded-lg' : 'h-8 w-8 rounded-[9px]';
  const icon = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className={cn('icon-tile icon-tile-accent', tile)}>
        <ShieldCheck className={icon} strokeWidth={2.25} aria-hidden="true" />
      </span>
      {showWordmark && (
        <span className={cn('font-semibold tracking-tight', wordmarkClassName, size === 'lg' ? 'text-lg' : 'text-[15px]')}>
          SoulShield
        </span>
      )}
    </span>
  );
}
