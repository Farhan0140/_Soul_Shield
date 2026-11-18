import { useState, useEffect } from 'react';
import { useApi } from '../context/ApiContext';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY_STATS = {
  totalCompleted: 0, completionRate: 0, streak: 0,
  favoriteCategory: null, favoriteCategoryCount: 0,
  bestDay: null, totalTasks: 0,
};

/**
 * Personal stats for the profile page, computed by the server
 * (GET /tasks/stats) over the last year. This used to download a full year of
 * history and crunch it in the browser; it also parsed dates as UTC, which put
 * "best day" on the wrong weekday for users west of UTC.
 */
export function usePersonalStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getPersonalStats } = useApi();

  useEffect(() => {
    let ignore = false;
    getPersonalStats(365)
      .then((s) => {
        if (ignore) return;
        setStats({
          totalCompleted: s.total_completed ?? 0,
          completionRate: s.completion_rate ?? 0,
          streak: s.streak ?? 0,
          favoriteCategory: s.favorite_category ?? null,
          favoriteCategoryCount: s.favorite_category_count ?? 0,
          bestDay: s.best_weekday == null ? null : DAY_NAMES[s.best_weekday] ?? null,
          totalTasks: s.total_tasks ?? 0,
        });
      })
      .catch((err) => {
        console.warn('Stats load failed:', err.message);
        if (!ignore) setStats(EMPTY_STATS);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [getPersonalStats]);

  return { stats, loading };
}
