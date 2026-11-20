import { Target, Flame, Trophy, TrendingUp } from 'lucide-react';
import StatCard from './StatCard';
import { fmtDate, parseDateKey } from '../hooks/useTasks';

// Compute streak from byDate (consecutive days ending today or yesterday with ≥1 completion)
function computeStreak(byDate) {
  let streak = 0;
  const d = new Date();
  // Check if today has completions; if not, start from yesterday
  // Local calendar day (toISOString is UTC, which put the boundary at the
  // wrong hour for anyone outside UTC and broke or inflated streaks).
  const todayKey = fmtDate(d);
  const todayTasks = byDate[todayKey] || [];
  const todayCompleted = todayTasks.some(t => t.status === 'completed');
  if (!todayCompleted) d.setDate(d.getDate() - 1);

  while (true) {
    const key = fmtDate(d);
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
      const d = parseDateKey(t.date);
      counts[d.getDay()]++;
    }
  });
  const max = Math.max(...counts);
  if (max === 0) return null;
  return DAY_NAMES[counts.indexOf(max)];
}

export default function WeeklyStats({ stats }) {
  const streak = computeStreak(stats.byDate);
  const best = bestDay(stats.byDate);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={Target}
        accent
        label="Completion rate"
        value={stats.completionRate}
        suffix="%"
        sub={`${stats.completed} of ${stats.totalTasks}`}
      />
      <StatCard
        icon={Flame}
        label="Current streak"
        value={`${streak} day${streak === 1 ? '' : 's'}`}
        sub={streak > 0 ? "Days in a row" : "No streak yet"}
        delay={0.04}
      />
      <StatCard
        icon={Trophy}
        label="Completed"
        value={stats.completed}
        sub={`${stats.missed} missed`}
        delay={0.08}
      />
      <StatCard
        icon={TrendingUp}
        label="Best day"
        value={best || '—'}
        sub={best ? 'Most productive' : 'No completions yet'}
        delay={0.12}
      />
    </div>
  );
}
