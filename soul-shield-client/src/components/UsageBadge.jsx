import { motion } from 'framer-motion';
import { Users, CheckCircle2, TrendingUp } from 'lucide-react';

export default function UsageBadge({ usage, compact = false }) {
  if (!usage) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-slate-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-semibold tabular-nums">{usage.completions}</span>
          <span className="text-slate-400">/ {usage.total}</span>
        </span>
        <span className={`font-semibold tabular-nums ${
          usage.completionRate >= 75 ? 'text-emerald-600' :
          usage.completionRate >= 50 ? 'text-amber-600' :
          'text-rose-600'
        }`}>
          {usage.completionRate}%
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-slate-200"
    >
      <div className="flex items-center gap-1.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Completions</p>
          <p className="text-sm font-bold text-slate-800 tabular-nums">
            {usage.completions}
            <span className="text-slate-400 font-normal"> / {usage.total}</span>
          </p>
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200" />

      <div className="flex items-center gap-1.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Rate</p>
          <p className={`text-sm font-bold tabular-nums ${
            usage.completionRate >= 75 ? 'text-emerald-600' :
            usage.completionRate >= 50 ? 'text-amber-600' :
            'text-rose-600'
          }`}>
            {usage.completionRate}%
          </p>
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200" />

      <div className="flex items-center gap-1.5">
        <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
          <Users className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Active days</p>
          <p className="text-sm font-bold text-slate-800 tabular-nums">{usage.activeDays}</p>
        </div>
      </div>
    </motion.div>
  );
}