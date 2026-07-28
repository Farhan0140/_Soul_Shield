import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../context/ApiContext';
import { fmtDate } from './useTasks';

// Default range: last 7 days
export const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return { from, to };
};

export function useHistory() {
  const [range, setRange] = useState(defaultRange());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getTasksHistory } = useApi();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTasksHistory(fmtDate(range.from), fmtDate(range.to));
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [range, getTasksHistory]);

  useEffect(() => { load(); }, [load]);

  // Group items by date → { 'YYYY-MM-DD': [tasks...] }
  const byDate = items.reduce((acc, t) => {
    (acc[t.date] = acc[t.date] || []).push(t);
    return acc;
  }, {});

  // Sorted date keys (newest first)
  const sortedDates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));

  // Stats
  const stats = {
    totalTasks: items.length,
    completed: items.filter(t => t.status === 'completed').length,
    missed: items.filter(t => t.status === 'missed').length,
    pending: items.filter(t => t.status === 'pending').length,
    completionRate: items.length === 0 ? 0 : Math.round(
      (items.filter(t => t.status === 'completed').length / items.length) * 100
    ),
    byDate, // for heatmap
    sortedDates,
  };

  return { range, setRange, items, byDate, sortedDates, stats, loading, error, reload: load };
}