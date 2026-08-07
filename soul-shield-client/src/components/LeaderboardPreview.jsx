import { m } from 'framer-motion';
import { Trophy, Users, Lock, Sparkles } from 'lucide-react';

// Mock data — will be replaced by real endpoint when available
const MOCK_LEADERS = [
  { rank: 1, name: 'Ahmed R.', completed: 47, rate: 94 },
  { rank: 2, name: 'Fatima K.', completed: 43, rate: 86 },
  { rank: 3, name: 'Omar S.', completed: 39, rate: 78 },
  { rank: 4, name: 'Aisha M.', completed: 35, rate: 70 },
  { rank: 5, name: 'Yusuf H.', completed: 31, rate: 62 },
];

const MEDAL_COLORS = {
  1: 'from-amber-400 to-yellow-500',
  2: 'from-slate-300 to-slate-400',
  3: 'from-orange-400 to-amber-600',
};

export default function LeaderboardPreview() {
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-2xl border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-fg">Leaderboard</h3>
            <p className="text-xs text-muted">Top performers on fixed tasks (last 30 days)</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-bg text-muted text-[10px] font-bold uppercase tracking-wide">
          <Lock className="w-3 h-3" /> Preview
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-border">
        {MOCK_LEADERS.map((leader, i) => (
          <m.div
            key={leader.rank}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 p-4 hover:bg-bg transition-colors"
          >
            {/* Rank */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0
              ${leader.rank <= 3 ? `bg-gradient-to-br ${MEDAL_COLORS[leader.rank]} text-white shadow-sm` : 'bg-bg text-muted'}
            `}>
              {leader.rank}
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {leader.name[0]}
            </div>

            {/* Name + stats */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fg truncate">{leader.name}</p>
              <p className="text-xs text-muted">{leader.completed} tasks completed</p>
            </div>

            {/* Rate */}
            <div className="text-right">
              <p className={`text-sm font-bold tabular-nums ${
                leader.rate >= 80 ? 'text-success' :
                leader.rate >= 60 ? 'text-warning' :
                'text-danger'
              }`}>
                {leader.rate}%
              </p>
              <p className="text-[10px] text-muted uppercase font-semibold">Rate</p>
            </div>
          </m.div>
        ))}
      </div>

      {/* Coming soon footer */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-primary/10 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-xs text-primary">
          <strong>Coming soon:</strong> Real-time leaderboard powered by a dedicated backend endpoint.
        </p>
      </div>
    </m.div>
  );
}