import { Users, UserPlus, Activity, CalendarCheck, Info } from 'lucide-react';
import Alert from './ui/Alert';

/**
 * Real community numbers for the admin panel (GET /admin/stats). Replaces the
 * old LeaderboardPreview, which showed hard-coded mock users.
 */
export default function CommunityOverview({ overview }) {
  if (!overview) {
    return (
      <Alert tone="neutral" icon={Info}>
        Community statistics are unavailable right now.
      </Alert>
    );
  }

  const items = [
    { label: 'Total users', value: overview.totalUsers, icon: Users },
    { label: `New (${overview.days}d)`, value: overview.newUsers, icon: UserPlus },
    { label: 'Active today', value: overview.activeToday, icon: Activity },
    { label: `Active (${overview.days}d)`, value: overview.activeUsers, icon: CalendarCheck },
  ];

  return (
    <div className="card overflow-hidden">
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {items.map(({ label, value, icon: Icon }, i) => (
          <div
            key={label}
            className={`min-w-0 p-4 sm:p-5 ${i % 2 === 1 ? 'border-l border-border' : ''} ${i >= 2 ? 'border-t border-border sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''}`}
          >
            <dt className="flex items-center gap-1.5 truncate text-xs font-medium text-muted">
              <Icon className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
              {label}
            </dt>
            <dd className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-fg">{value ?? 0}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted sm:px-5">
        "Active" means the user recorded progress on at least one task. Completion rates are estimates:
        completions ÷ (scheduled days × active users).
      </p>
    </div>
  );
}
