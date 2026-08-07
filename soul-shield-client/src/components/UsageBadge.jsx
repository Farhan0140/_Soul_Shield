import { m } from 'framer-motion';
import { Users, CheckCircle2, TrendingUp } from 'lucide-react';

export default function UsageBadge({ usage, compact = false }) {
  if (!usage) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-muted">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          <span className="font-semibold tabular-nums">{usage.completions}</span>
          <span className="text-muted">/ {usage.total}</span>
        </span>
        <span className={`font-semibold tabular-nums ${
          usage.completionRate >= 75 ? 'text-success' :
          usage.completionRate >= 50 ? 'text-warning' :
          'text-danger'
        }`}>
          {usage.completionRate}%
        </span>
      </div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-border"
    >
      <div className="flex items-center gap-1.5">
        <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-success" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase">Completions</p>
          <p className="text-sm font-bold text-fg tabular-nums">
            {usage.completions}
            <span className="text-muted font-normal"> / {usage.total}</span>
          </p>
        </div>
      </div>

      <div className="h-8 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase">Rate</p>
          <p className={`text-sm font-bold tabular-nums ${
            usage.completionRate >= 75 ? 'text-success' :
            usage.completionRate >= 50 ? 'text-warning' :
            'text-danger'
          }`}>
            {usage.completionRate}%
          </p>
        </div>
      </div>

      <div className="h-8 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
          <Users className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase">Active days</p>
          <p className="text-sm font-bold text-fg tabular-nums">{usage.activeDays}</p>
        </div>
      </div>
    </m.div>
  );
}