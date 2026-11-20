import { cn } from '../../utils/cn';

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Initials avatar on a quiet raised tile. */
export default function Avatar({ name, size = 36, className = '' }) {
  return (
    <span
      className={cn('icon-tile select-none rounded-full font-medium text-fg-2', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      role="img"
      aria-label={name ? `Avatar for ${name}` : 'Avatar'}
    >
      {initialsOf(name)}
    </span>
  );
}
