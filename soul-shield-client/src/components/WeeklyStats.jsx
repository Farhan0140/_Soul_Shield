import { motion } from 'framer-motion';
import { Target, Flame, Trophy, TrendingUp } from 'lucide-react';

// Compute streak from byDate (consecutive days ending today or yesterday with ≥1 completion)
function computeStreak(byDate) {
  let streak = 0;
  const d = new Date();
  // Check if today has completions; if not, start from yesterday
  const todayKey = d.toISOString().slice(0, 10);
  const todayTasks = byDate[todayKey] || [];
  const todayCompleted = todayTasks.some(t => t.status === 'completed');
  if (!todayCompleted) d.setDate(d.getDate() - 1);

  while (true) {
    const key = d.toISOString().slice(0, 10);
    const tasks = byDate[key] || [];
    if (tasks.some(t => t.status === 'completed')) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

// Most productive day (day of week with most completions)
function bestDay(byDate) {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const counts = Array(7).fill(0);
  Object.values(byDate).flat().forEach(t => {
    if (t.status === 'completed') {
      const d = new Date(t.date);
      counts[d.getDay()]++;
    }
  });
  const max = Math.max(...counts);
  if (max === 0) return null;
  return DAY_NAMES[counts.indexOf(max)];
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function WeeklyStats({ stats }) {
  const streak = computeStreak(stats.byDate);
  const best = bestDay(stats.byDate);

  const cards = [
    {
      icon: Target,
      label: 'Completion rate',
      value: `${stats.completionRate}%`,
      sub: `${stats.completed} of ${stats.totalTasks}`,
      gradient: 'from-indigo-500 to-purple-600',
      bg: 'bg-indigo-50',
    },
    {
      icon: Flame,
      label: 'Current streak',
      value: `${streak} day${streak === 1 ? '' : 's'}`,
      sub: streak > 0 ? "Keep it going 🔥" : "Start one today!",
      gradient: 'from-orange-500 to-rose-500',
      bg: 'bg-orange-50',
    },
    {
      icon: Trophy,
      label: 'Completed',
      value: stats.completed,
      sub: `${stats.missed} missed`,
      gradient: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
    },
    {
      icon: TrendingUp,
      label: 'Best day',
      value: best || '—',
      sub: best ? 'Most productive' : 'No completions yet',
      gradient: 'from-sky-500 to-indigo-500',
      bg: 'bg-sky-50',
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3"
    >
      {cards.map((c, i) => (
        <motion.div
          key={i}
          variants={item}
          whileHover={{ y: -4, scale: 1.02 }}
          className="relative bg-white rounded-2xl border border-slate-200 p-4 overflow-hidden group"
        >
          <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full ${c.bg} opacity-60 group-hover:scale-125 transition-transform duration-500`} />
          <div className="relative">
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${c.gradient} mb-3`}>
              <c.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}