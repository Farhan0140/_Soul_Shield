import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { ThemedText } from '@/components/themed-text';
import { TaskProgressChart } from '@/components/dashboard/task-progress-chart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useLocale } from '@/context/locale-context';
import { useTaskHistoryQuery } from '@/hooks/queries/use-tasks';
import { useThemeColor } from '@/hooks/use-theme-color';
import { addDays, todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';
import { computeInsightStats } from '@/lib/insights';

type RangeDays = 30 | 90;

/** Insights (#7): 30/90-day completion stats, streaks, favorite category and
 * best weekday — all computed on-device from the local-first derived history
 * (computeInsightStats), so it works offline and refreshes with every
 * mutation/sync like the rest of the app.
 *
 * "Share Progress" (#18) snapshots the highlighted summary card with
 * react-native-view-shot and hands the PNG to the native share sheet
 * (expo-sharing); falls back to a plain-text Share if either step fails. */
export default function InsightsScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [sharing, setSharing] = useState(false);
  const summaryRef = useRef<View>(null);

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success');
  const text = useThemeColor({}, 'text');

  const today = todayISODate();
  const from = addDays(today, -(rangeDays - 1));
  const { data: history, isPending, isError } = useTaskHistoryQuery(from, today);

  const stats = useMemo(() => computeInsightStats(history ?? []), [history]);

  const handleShare = async () => {
    setSharing(true);
    try {
      const textSummary = `${t('insights.completionRate')}: ${stats.completionRate}% · ${t('insights.totalCompleted')}: ${stats.completed}/${stats.totalTasks} · ${t('insights.currentStreak')}: ${stats.currentStreak}`;
      if (summaryRef.current && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(summaryRef, { format: 'png', quality: 1, result: 'tmpfile' });
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: t('insights.share'),
          UTI: 'public.png',
        });
        return;
      }
      await Share.share({ title: t('insights.share'), message: textSummary });
    } catch (err) {
      if (Platform.OS !== 'ios' || !String((err as Error)?.message ?? '').includes('dismissed')) {
        Alert.alert(t('insights.share'), getErrorMessage(err));
      }
    } finally {
      setSharing(false);
    }
  };

  const statCards: { label: string; value: string }[] = [
    { label: t('insights.completionRate'), value: `${stats.completionRate}%` },
    { label: t('insights.totalCompleted'), value: `${stats.completed}/${stats.totalTasks}` },
    { label: t('insights.currentStreak'), value: `${stats.currentStreak}` },
    { label: t('insights.bestStreak'), value: `${stats.bestStreak}` },
    { label: t('insights.favoriteCategory'), value: stats.favoriteCategory ?? '—' },
    { label: t('insights.bestWeekday'), value: stats.bestWeekday ?? '—' },
  ];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
          <IconSymbol name="chevron.left" size={22} color={tint} />
        </Pressable>
        <ThemedText type="title">{t('insights.title')}</ThemedText>
      </View>

      <View style={styles.rangeRow}>
        {([30, 90] as RangeDays[]).map((days) => (
          <Pressable
            key={days}
            onPress={() => setRangeDays(days)}
            style={({ pressed }) => [
              styles.rangeChip,
              {
                backgroundColor: rangeDays === days ? `${tint}1A` : cardColor,
                borderColor: rangeDays === days ? tint : borderColor,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <ThemedText
              type="defaultSemiBold"
              style={[styles.rangeLabel, { color: rangeDays === days ? tint : mutedColor }]}>
              {days === 30 ? t('insights.days') : t('insights.days90')}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {isPending || isError ? (
        <SkeletonCard />
      ) : (
        <>
          {/* Shown as-is by "Share Progress" — keep this subtree self-contained */}
          <View
            ref={summaryRef}
            collapsable={false}
            style={[styles.summaryCard, { backgroundColor: cardColor, borderColor }]}>
            <TaskProgressChart selectedDate={today} />

            <View style={styles.grid}>
              {statCards.map((card) => (
                <View key={card.label} style={[styles.statCard, { borderColor }]}>
                  <ThemedText style={[styles.statLabel, { color: mutedColor }]} numberOfLines={1}>
                    {card.label}
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={[styles.statValue, { color: text }]}>
                    {card.value}
                  </ThemedText>
                </View>
              ))}
            </View>

            {stats.completionRate >= 70 ? (
              <ThemedText style={[styles.praise, { color: successColor }]}>
                ✨ Strong pace — keep your streak alive!
              </ThemedText>
            ) : null}
          </View>

          <PrimaryButton label={t('insights.share')} loading={sharing} onPress={handleShare} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 60, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rangeRow: { flexDirection: 'row', gap: 10 },
  rangeChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  rangeLabel: { fontSize: 13 },
  summaryCard: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '31%',
    minWidth: 100,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 10,
    gap: 2,
  },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 15 },
  praise: { fontSize: 13, textAlign: 'center' },
});
