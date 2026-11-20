import { Users, CheckCircle2, TrendingUp } from 'lucide-react';
import { cn } from '../utils/cn';

const rateTone = (rate) => (rate >= 75 ? 'text-success' : rate >= 50 ? 'text-warning' : 'text-danger');

function Metric({ icon: Icon, label, children, title }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5" title={title}>
      <Icon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums text-fg">{children}</p>
      </div>
    </div>
  );
}

export default function UsageBadge({ usage, compact = false }) {
  if (!usage) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-muted">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span className="font-semibold tabular-nums">{usage.completions}</span>
          <span className="text-muted" title="Most completions possible: scheduled days × active users">/ {usage.total}</span>
        </span>
        <span className={cn('font-semibold tabular-nums', rateTone(usage.completionRate))}>
          {usage.completionRate}%
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-surface-2">
      <Metric icon={CheckCircle2} label="Completions" title="Most completions possible: scheduled days × active users">
        {usage.completions}
        <span className="font-normal text-muted"> / {usage.total}</span>
      </Metric>
      <Metric icon={TrendingUp} label="Rate">
        <span className={rateTone(usage.completionRate)}>{usage.completionRate}%</span>
      </Metric>
      <Metric icon={Users} label="Users" title={`${usage.addedBy ?? 0} added it to their own tasks`}>
        {usage.users}
      </Metric>
    </div>
  );
}
