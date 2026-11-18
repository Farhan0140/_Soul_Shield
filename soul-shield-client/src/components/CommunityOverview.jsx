import { m } from 'framer-motion';
import { Users, UserPlus, Activity, CalendarCheck } from 'lucide-react';

/**
 * Real community numbers for the admin panel (GET /admin/stats). Replaces the
 * old LeaderboardPreview, which showed hard-coded mock users.
 */
export default function CommunityOverview({ overview }) {
  if (!overview) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-5 text-sm text-muted">
        Community statistics are unavailable right now.
      </div>
    );
  }

  const items = [
    { label: 'Total users', value: overview.totalUsers, icon: Users, tone: 'text-primary bg-primary/10' },
    { label: `New (${overview.days}d)`, value: overview.newUsers, icon: UserPlus, tone: 'text-success bg-success/10' },
    { label: 'Active today', value: overview.activeToday, icon: Activity, tone: 'text-warning bg-warning/10' },
    { label: `Active (${overview.days}d)`, value: overview.activeUsers, icon: CalendarCheck, tone: 'text-primary bg-primary/10' },
  ];

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-2xl border border-border p-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      {items.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted truncate">{label}</p>
            <p className="text-lg font-bold text-fg tabular-nums">{value ?? 0}</p>
          </div>
        </div>
      ))}
      <p className="col-span-2 sm:col-span-4 text-[11px] text-muted">
        "Active" means the user recorded progress on at least one task. Completion rates are estimates:
        completions ÷ (scheduled days × active users).
      </p>
    </m.div>
  );
}
