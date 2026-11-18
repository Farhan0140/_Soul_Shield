import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../context/ApiContext';
import { fmtDate } from './useTasks';

const USAGE_WINDOW_DAYS = 30;

export function useAdminTasks() {
  const [tasks, setTasks] = useState([]);
  // { [task_id]: { completions, total, completionRate, users, addedBy } }
  const [usage, setUsage] = useState({});
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getTasks, getAdminStats } = useApi();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all tasks (we'll filter client-side to is_global)
      // Alternative: backend could expose /tasks?is_global=true — we use client filter for now
      const today = new Date();
      const data = await getTasks(fmtDate(today));
      const globalTasks = (Array.isArray(data) ? data : []).filter(t => t.is_global);
      setTasks(globalTasks);

      // Real usage across ALL users over the last 30 days (GET /admin/stats).
      // This used to be derived from the admin's OWN history, so every
      // number on the page described one person. Best-effort: the task list
      // still works if stats fail.
      try {
        const stats = await getAdminStats(USAGE_WINDOW_DAYS);
        const usageMap = {};
        (stats.tasks || []).forEach((t) => {
          usageMap[t.task_id] = {
            completions: t.completions,
            // Scheduled days x active users: the most completions possible.
            total: t.opportunities,
            completionRate: t.completion_rate,
            users: t.users,
            addedBy: t.added_by,
          };
        });
        setUsage(usageMap);
        setOverview({
          totalUsers: stats.total_users,
          newUsers: stats.new_users,
          activeToday: stats.active_today,
          activeUsers: stats.active_users,
          days: stats.days,
        });
      } catch {
        setUsage({});
        setOverview(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getTasks, getAdminStats]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this effect starts
  useEffect(() => { load(); }, [load]);

  const updateTask = (taskId, patch) => {
    setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, ...patch } : t));
  };

  const removeTask = (taskId) => {
    setTasks(prev => prev.filter(t => t.task_id !== taskId));
  };

  const addTask = (task) => {
    setTasks(prev => [...prev, task]);
  };

  return { tasks, usage, overview, loading, error, reload: load, updateTask, removeTask, addTask };
}