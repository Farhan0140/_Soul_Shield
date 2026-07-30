import { useState, useEffect } from 'react';
import { useApi } from '../context/ApiContext';
import { fmtDate } from './useTasks';

export function usePersonalStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getTasksHistory } = useApi();

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        // Fetch last 365 days of history
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 365);

        const history = await getTasksHistory(fmtDate(from), fmtDate(to));
        const items = Array.isArray(history) ? history : [];

        const completed = items.filter(t => t.status === 'completed');
        const total = items.length;

        // Completion rate
        const completionRate = total === 0 ? 0 : Math.round((completed.length / total) * 100);

        // Current streak (consecutive days ending today/yesterday with ≥1 completion)
        let streak = 0;
        const completedByDate = new Set(completed.map(t => t.date));
        const d = new Date();
        if (!completedByDate.has(fmtDate(d))) d.setDate(d.getDate() - 1);
        while (completedByDate.has(fmtDate(d))) {
          streak++;
          d.setDate(d.getDate() - 1);
        }

        // Favorite category (most completions)
        const catCounts = {};
        completed.forEach(t => {
          if (t.category_name) {
            catCounts[t.category_name] = (catCounts[t.category_name] || 0) + 1;
          }
        });
        const favCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

        // Most productive day of week
        const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayCounts = Array(7).fill(0);
        completed.forEach(t => {
          const dt = new Date(t.date);
          dayCounts[dt.getDay()]++;
        });
        const maxDay = Math.max(...dayCounts);
        const bestDay = maxDay === 0 ? null : DAY_NAMES[dayCounts.indexOf(maxDay)];

        if (ignore) return;
        setStats({
          totalCompleted: completed.length,
          completionRate,
          streak,
          favoriteCategory: favCat ? favCat[0] : null,
          favoriteCategoryCount: favCat ? favCat[1] : 0,
          bestDay,
          totalTasks: total,
        });
      } catch (err) {
        console.warn('Stats load failed:', err.message);
        if (ignore) return;
        setStats({
          totalCompleted: 0, completionRate: 0, streak: 0,
          favoriteCategory: null, favoriteCategoryCount: 0,
          bestDay: null, totalTasks: 0,
        });
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, [getTasksHistory]);

  return { stats, loading };
}