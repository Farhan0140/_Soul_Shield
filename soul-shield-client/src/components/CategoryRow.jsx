import { m } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

/** Collapsed category summary row — name, accent dot/icon, task count, and a
 * chevron — used on the dashboard in place of showing every task inline.
 * Tapping navigates to a dedicated page listing that category's full task
 * cards (see pages/CategoryDetail.jsx), mirroring the mobile app's
 * CategorySection-as-a-link pattern. */
export default function CategoryRow({ title, count, accentColor, icon: Icon, onClick }) {
  return (
    <m.button
      type="button"
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-surface border border-border hover:shadow-md transition-all text-left"
      style={{ borderLeftWidth: '4px', borderLeftColor: accentColor }}
    >
      {Icon ? (
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
      ) : (
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
      )}
      <span className="flex-1 font-semibold text-fg truncate">{title}</span>
      <span className="text-sm text-muted tabular-nums">{count}</span>
      <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
    </m.button>
  );
}
