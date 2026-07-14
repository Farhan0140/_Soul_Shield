import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { fmtDate } from './useTasks';

export function useAdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [usage, setUsage] = useState({}); // { taskId: { users: N, completions: N } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all tasks (we'll filter client-side to is_global)
      // Alternative: backend could expose /tasks?is_global=true — we use client filter for now
      const today = new Date();
      const data = await api.get(`/tasks?date=${fmtDate(today)}`);
      const globalTasks = (Array.isArray(data) ? data : []).filter(t => t.is_global);
      setTasks(globalTasks);

      // Fetch usage stats from last 30 days of history
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 30);
        const history = await api.get(`/tasks/history?from=${fmtDate(from)}&to=${fmtDate(to)}`);
        const items = Array.isArray(history) ? history : [];

        const usageMap = {};
        items.forEach(t => {
          if (!t.is_global || !t.task_id) return;
          if (!usageMap[t.task_id]) {
            usageMap[t.task_id] = { users: new Set(), completions: 0, total: 0 };
          }
          usageMap[t.task_id].total++;
          if (t.status === 'completed') {
            usageMap[t.task_id].completions++;
            // We don't have user_id in history, so estimate unique users by dates
            usageMap[t.task_id].users.add(t.date);
          }
        });

        const finalUsage = {};
        Object.entries(usageMap).forEach(([id, u]) => {
          finalUsage[id] = {
            completions: u.completions,
            total: u.total,
            completionRate: u.total === 0 ? 0 : Math.round((u.completions / u.total) * 100),
            activeDays: u.users.size,
          };
        });
        setUsage(finalUsage);
      } catch {
        // Usage stats are best-effort
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return { tasks, usage, loading, error, reload: load, updateTask, removeTask, addTask };
}