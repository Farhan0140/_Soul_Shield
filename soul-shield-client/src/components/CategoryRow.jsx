import { ChevronRight } from 'lucide-react';

/** Collapsed category summary row — name, color dot (or icon), task count, and
 * a chevron — used on the dashboard in place of showing every task inline.
 * Tapping navigates to a dedicated page listing that category's full task
 * cards (see pages/CategoryDetail.jsx), mirroring the mobile app's
 * CategorySection-as-a-link pattern. Rendered inside a divided list card. */
export default function CategoryRow({ title, count, accentColor, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-14 w-full items-center gap-3 px-5 text-left transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2 active:bg-sunken"
    >
      <span className="flex w-5 shrink-0 items-center justify-center" aria-hidden="true">
        {Icon ? (
          <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
        ) : (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{title}</span>
      <span className="text-[13px] tabular-nums text-muted">
        {count}
        <span className="sr-only"> tasks</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-colors group-hover:text-fg-2" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
