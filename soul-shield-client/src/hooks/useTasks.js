import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../context/ApiContext';

// Format date as YYYY-MM-DD
export const fmtDate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Friendly date label: "Today, Jul 14" or "Jul 10"
export const prettyDate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const today = new Date();
  const isToday = fmtDate(dt) === fmtDate(today);
  const str = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return isToday ? `Today, ${str}` : str;
};

export function useTasks(initialDate = new Date()) {
  const [date, setDate] = useState(initialDate);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getTasks } = useApi();

  const load = useCallback(async (d = date) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTasks(fmtDate(d));
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [date, getTasks]);

  useEffect(() => { load(); }, [load]);

  const shiftDate = (delta) => setDate(d => new Date(d.getTime() + delta * 86400000));
  const goToday = () => setDate(new Date());

  // Optimistic update helpers
  const updateTask = (taskId, patch) => {
    setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, ...patch } : t));
  };

  const removeTask = (taskId) => {
    setTasks(prev => prev.filter(t => t.task_id !== taskId));
  };

  const addTask = (task) => {
    setTasks(prev => [...prev, task]);
  };

  return {
    date, setDate, tasks, loading, error,
    shiftDate, goToday, reload: load,
    updateTask, removeTask, addTask,
    isToday: fmtDate(date) === fmtDate(new Date()),
  };
}