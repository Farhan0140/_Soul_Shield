import { ChevronRight } from 'lucide-react';

/** Collapsed category summary row — name, accent dot/icon, task count, and a
 * chevron — used on the dashboard in place of showing every task inline.
 * Tapping navigates to a dedicated page listing that category's full task
 * cards (see pages/CategoryDetail.jsx), mirroring the mobile app's
 * CategorySection-as-a-link pattern. Rendered inside a divided list card. */
export default function CategoryRow({ title, count, accentColor, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2 active:bg-sunken sm:px-5"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border"
        style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 13%, var(--surface))` }}
        aria-hidden="true"
      >
        {Icon ? (
          <Icon className="h-4 w-4" style={{ color: accentColor }} />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{title}</span>
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-sunken px-1.5 text-xs font-semibold tabular-nums text-fg-2">
        {count}
        <span className="sr-only"> tasks</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}
