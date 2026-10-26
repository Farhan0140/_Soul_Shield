import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from '@/context/locale-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { listOwnCompletedDatesInRange } from '@/lib/db/tasks-repo';
import { addDays, todayISODate } from '@/lib/date';

const MILESTONE_KEY = 'soulshield_shown_streak_milestones';
const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];
// Mirrors lib/insights.ts's ownership rule: the streak counts own (non-global) tasks only —
// same as the History heatmap and the completion rate stats.
const STREAK_WINDOW_DAYS = 365;

/** "🔥 N-day streak" pill, shown on Home above the progress chart. Tapping it
 * opens the Insights screen. Requires one completed own (non-global) task per
 * day; computed from the same local-first derived data as everywhere else, so
 * it updates immediately after any completion, offline included — mutations
 * invalidate ['taskHistory'], which is exactly the key this reads. */
export function StreakChip() {
  const { t } = useLocale();
  const tint = useThemeColor({}, 'tint');
  const cardColor = useThemeColor({}, 'card');
  const warningColor = useThemeColor({}, 'warning');
  const mutedColor = useThemeColor({}, 'muted');

  const today = todayISODate();
  const from = addDays(today, -(STREAK_WINDOW_DAYS - 1));
  // Deliberately NOT keyed under ['taskHistory'] — that key is invalidated by
  // every mutation/sync, and deriving a 365-day window per tap stalled the UI
  // (see listOwnCompletedDatesInRange). This reads only completed-dates rows.
  const { data: completedDateList, isPending } = useQuery({
    queryKey: ['completedDates', from, today],
    queryFn: () => listOwnCompletedDatesInRange(from, today),
    networkMode: 'always',
  });

  // Only read the shown-milestone list once per session; new milestones are
  // merged into it synchronously so the alert can never double-fire while
  // the component stays mounted.
  const shownMilestones = useRef<Set<number> | null>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (isPending || !completedDateList) return;
    const done = new Set(completedDateList);

    let streak = 0;
    let cursor = today;
    if (!done.has(cursor)) cursor = addDays(cursor, -1);
    while (done.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    setCurrent(streak);

    if (shownMilestones.current === null) {
      shownMilestones.current = new Set();
      AsyncStorage.getItem(MILESTONE_KEY)
        .then((raw) => {
          shownMilestones.current = new Set<number>(raw ? (JSON.parse(raw) as number[]) : []);
          celebrateIfMilestone(streak);
        })
        .catch(() => celebrateIfMilestone(streak));
      return;
    }
    celebrateIfMilestone(streak);
    // `today` is stable within a calendar day; re-running on the completed-
    // dates refresh (mutation invalidation of ['completedDates']) is the
    // intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedDateList, isPending]);

  const celebrateIfMilestone = (streak: number) => {
    const shown = shownMilestones.current;
    if (!shown) return;
    const reached = MILESTONES.find((m) => streak >= m && !shown.has(m));
    if (!reached) return;
    shown.add(reached);
    AsyncStorage.setItem(MILESTONE_KEY, JSON.stringify([...shown])).catch(() => {});
    Alert.alert(
      `🔥 ${reached}-day streak!`,
      'You kept your streak going — every day counts. Keep it up!',
      [{ text: 'Alhamdulillah ✨' }]
    );
  };

  if (isPending || current <= 0) return null;

  return (
    <Pressable
      // Typed routes only regenerate during `expo start` — the new /insights
      // screen isn't in the checked-in .expo types yet; cast is safe.
      onPress={() => router.push('/insights' as never)}
      accessibilityRole="button"
      accessibilityLabel={`${current} day streak`}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: cardColor, opacity: pressed ? 0.8 : 1, borderColor: `${warningColor}55` },
      ]}>
      <Text style={styles.flame}>🔥</Text>
      <Text style={[styles.count, { color: tint }]}>{current}</Text>
      <Text style={[styles.label, { color: mutedColor }]}>{t('home.streakDays')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  flame: { fontSize: 13 },
  count: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 12 },
});
