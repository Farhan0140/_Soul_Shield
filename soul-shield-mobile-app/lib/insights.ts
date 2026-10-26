import { addDays, todayISODate, weekdayIndex } from '@/lib/date';
import type { Task } from '@/api/types';

/** Shared aggregation over the local-first derived tasks (the same
 * TaskWithStatus shapes the day list and History read) — one place so the
 * streak chip, Insights screen, and anything later agree on the numbers.
 *
 * All stats intentionally follow the History screen's ownership rule:
 * is_global tasks a user hasn't cloned into their own tasks aren't "their"
 * habit history, so they're excluded (consistent with the heatmap and the
 * home progress bar). */

export interface StreakInfo {
  /** Consecutive days ending today (or yesterday, if today isn't done yet). */
  current: number;
  /** Longest consecutive run anywhere in the provided data. */
  best: number;
}

export function computeStreaks(completedDates: Iterable<string>, today: string = todayISODate()): StreakInfo {
  const done = new Set(completedDates);
  if (done.size === 0) return { current: 0, best: 0 };

  let current = 0;
  let cursor = today;
  if (!done.has(cursor)) cursor = addDays(cursor, -1);
  while (done.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest run across the whole provided set.
  const sorted = [...done].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    if (previous !== null && addDays(previous, 1) === date) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    previous = date;
  }

  return { current, best };
}

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface InsightStats {
  totalTasks: number;
  completed: number;
  completionRate: number; // 0-100
  currentStreak: number;
  bestStreak: number;
  favoriteCategory: string | null;
  favoriteCategoryCount: number;
  bestWeekday: string | null;
  /** Per-weekday completed counts (index 0=Sunday), for future charts. */
  weekdayCounts: number[];
}

export function computeInsightStats(tasks: Task[]): InsightStats {
  const owned = tasks.filter((t) => !t.is_global);
  const completed = owned.filter((t) => t.status === 'completed');
  const total = owned.length;

  const completedDates = completed
    .filter((t) => t.date)
    .map((t) => t.date as string);
  const { current, best } = computeStreaks(completedDates);

  const categoryCounts = new Map<string, number>();
  for (const t of completed) {
    if (!t.category_name) continue;
    categoryCounts.set(t.category_name, (categoryCounts.get(t.category_name) ?? 0) + 1);
  }
  let favoriteCategory: string | null = null;
  let favoriteCategoryCount = 0;
  for (const [name, count] of categoryCounts) {
    if (count > favoriteCategoryCount) {
      favoriteCategory = name;
      favoriteCategoryCount = count;
    }
  }

  const weekdayCounts = Array(7).fill(0) as number[];
  for (const t of completed) {
    if (!t.date) continue;
    weekdayCounts[weekdayIndex(t.date)] += 1;
  }
  const maxDay = Math.max(...weekdayCounts);
  const bestWeekday = maxDay === 0 ? null : WEEKDAY_LABELS[weekdayCounts.indexOf(maxDay)];

  return {
    totalTasks: total,
    completed: completed.length,
    completionRate: total === 0 ? 0 : Math.round((completed.length / total) * 100),
    currentStreak: current,
    bestStreak: best,
    favoriteCategory,
    favoriteCategoryCount,
    bestWeekday,
    weekdayCounts,
  };
}

/** Convenience for callers that already know their window: a Set of every
 * date with at least one COMPLETED own (non-global) task — used by the
 * streak chip, which only needs dates, not per-day detail. */
export function datesWithCompletedTasks(history: Task[]): Set<string> {
  const set = new Set<string>();
  for (const t of history) {
    if (!t.is_global && t.status === 'completed' && t.date) set.add(t.date);
  }
  return set;
}
