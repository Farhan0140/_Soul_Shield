import { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useLocale } from '@/context/locale-context';
import { useTaskHistoryQuery } from '@/hooks/queries/use-tasks';
import { useThemeColor } from '@/hooks/use-theme-color';
import { addDays, dateRange, weekdayIndex, weekdayLabel } from '@/lib/date';

const DAYS_SHOWN = 7;
const CHART_HEIGHT = 150;
const PAD = { top: 14, right: 14, bottom: 32, left: 32 };

interface DayCounts {
  completed: number;
  partial: number;
}

/** Home-screen two-line chart of task progress over the last 7 days ending
 * at `selectedDate` (today + the previous 6 when today is selected; the
 * window follows the DateNavHeader's date — see app/(tabs)/index.tsx).
 *
 * Data comes from useTaskHistoryQuery, which is local-first: it runs
 * lib/db/tasks-repo.ts's deriveTasksForRange straight over the on-device
 * SQLite store, so it works offline for any synced range and — because every
 * mutation and every sync pull invalidates ['taskHistory'] — a completed or
 * partially-completed flip on ANY device/screen updates the chart
 * immediately, with no chart-specific fetching (requirement: reuse the
 * existing derived read path, don't hit the server per render).
 *
 * Counting reuses the app's existing status derivation unchanged: each
 * recurring task instance appears exactly once per (task, date) with a
 * derived status, and a sub-tasked parent is ONE task whose status is
 * derived from its children (computeParentStatus) — so counting
 * `completed` and `partially_completed` here can never double-count
 * sub-tasks or recurring instances (the same statuses the day list and
 * its progress bar show). Missed/pending days simply don't add to either
 * line.
 *
 * Line colors follow the active theme (useThemeColor) and match the
 * ProgressSummaryBar's established semantics: success = fully completed
 * (solid), warning = partially completed (dashed, the same "in-progress"
 * distinction the summary bar draws with its striped section). */
export function TaskProgressChart({ selectedDate }: { selectedDate: string }) {
  const { t } = useLocale();
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const warningColor = useThemeColor({}, 'warning');

  const from = addDays(selectedDate, -(DAYS_SHOWN - 1));
  const { data: history, isPending, isError } = useTaskHistoryQuery(from, selectedDate);
  const dates = useMemo(() => dateRange(from, selectedDate), [from, selectedDate]);

  const counts = useMemo(() => {
    const byDate = new Map<string, DayCounts>();
    for (const d of dates) byDate.set(d, { completed: 0, partial: 0 });
    for (const t of history ?? []) {
      const day = byDate.get(t.date);
      if (!day) continue;
      if (t.status === 'completed') day.completed += 1;
      else if (t.status === 'partially_completed') day.partial += 1;
    }
    return byDate;
  }, [dates, history]);

  const yMax = useMemo(() => {
    let max = 1;
    for (const c of counts.values()) max = Math.max(max, c.completed, c.partial);
    return max;
  }, [counts]);

  // Integer-friendly tick labels: every 1 up to 4, otherwise 4 rounded ticks.
  const ticks = useMemo(() => {
    const tickCount = yMax <= 4 ? yMax + 1 : 4;
    return Array.from({ length: tickCount }, (_, i) => Math.round((yMax / (tickCount - 1)) * i));
  }, [yMax]);

  const geometry = useMemo(() => {
    // Fallback width until onLayout fires (then exact measurement wins).
    const width = containerWidth ?? Math.max(windowWidth - 72, 240);
    const plotW = width - PAD.left - PAD.right;
    const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
    const x = (index: number) => PAD.left + (plotW * index) / (DAYS_SHOWN - 1);
    const y = (value: number) => PAD.top + plotH - (value / yMax) * plotH;
    const line = (pick: (c: DayCounts) => number) =>
      dates.map((d, i) => `${x(i)},${y(pick(counts.get(d) ?? { completed: 0, partial: 0 }))}`).join(' ');
    return {
      width,
      x,
      y,
      completedPoints: line((c) => c.completed),
      partialPoints: line((c) => c.partial),
    };
  }, [containerWidth, windowWidth, dates, counts, yMax]);

  return (
    <View
      style={[styles.card, { backgroundColor: cardColor, borderColor }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (containerWidth !== w) setContainerWidth(w);
      }}>
      <View style={styles.header}>
        <ThemedText type="defaultSemiBold" style={styles.title}>
          {t('home.chart.title')}
        </ThemedText>
        {/* Legend mirrors the summary bar's color semantics (see doc comment). */}
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: successColor }]} />
          <ThemedText style={[styles.legendLabel, { color: mutedColor }]}>{t('home.chart.completed')}</ThemedText>
          <View style={[styles.legendDot, styles.legendDotDashed, { backgroundColor: warningColor }]} />
          <ThemedText style={[styles.legendLabel, { color: mutedColor }]}>{t('home.chart.partial')}</ThemedText>
        </View>
      </View>

      {isPending ? (
        // Local derivation resolves within the same tick once SQLite is open;
        // this is only visible on the very first frame (or while the legacy
        // network fallback loads on a pre-rebuild build).
        <View style={styles.pendingChart} />
      ) : isError ? (
        <ThemedText style={[styles.fallbackText, { color: mutedColor }]}>
          Chart unavailable right now.
        </ThemedText>
      ) : (
        <Svg width={geometry.width} height={CHART_HEIGHT}>
          {/* Gridlines + Y labels */}
          {ticks.map((tick) => (
            <Line
              key={`grid-${tick}-${yMax}`}
              x1={PAD.left}
              x2={geometry.width - PAD.right}
              y1={geometry.y(tick)}
              y2={geometry.y(tick)}
              stroke={borderColor}
              strokeWidth={1}
              strokeDasharray={[3, 4]}
            />
          ))}
          {ticks.map((tick) => (
            <SvgText
              key={`ylab-${tick}-${yMax}`}
              x={PAD.left - 7}
              y={geometry.y(tick) + 3}
              textAnchor="end"
              fontSize={9}
              fill={mutedColor}>
              {String(tick)}
            </SvgText>
          ))}

          {/* X labels: weekday over day-of-month; the selected date is
              highlighted with the theme tint and bold */}
          {dates.map((d, i) => {
            const isSelected = d === selectedDate;
            const labelColor = isSelected ? tintColor : mutedColor;
            return (
              <SvgText
                key={`xlab-${d}`}
                x={geometry.x(i)}
                y={CHART_HEIGHT - PAD.bottom + 12}
                textAnchor="middle"
                fontSize={9}
                fontWeight={isSelected ? '700' : '400'}
                fill={labelColor}>
                {weekdayLabel(weekdayIndex(d))}
              </SvgText>
            );
          })}
          {dates.map((d, i) => {
            const isSelected = d === selectedDate;
            return (
              <SvgText
                key={`xday-${d}`}
                x={geometry.x(i)}
                y={CHART_HEIGHT - PAD.bottom + 24}
                textAnchor="middle"
                fontSize={9}
                fontWeight={isSelected ? '700' : '400'}
                fill={isSelected ? tintColor : mutedColor}>
                {d.slice(8)}
              </SvgText>
            );
          })}

          {/* Completed = solid success; partial = dashed warning (same color
              pairing as ProgressSummaryBar) */}
          <Polyline
            points={geometry.partialPoints}
            fill="none"
            stroke={warningColor}
            strokeWidth={2}
            strokeDasharray={[5, 4]}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Polyline
            points={geometry.completedPoints}
            fill="none"
            stroke={successColor}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Point markers — slightly larger on the selected day */}
          {dates.map((d, i) => {
            const c = counts.get(d) ?? { completed: 0, partial: 0 };
            const isSelected = d === selectedDate;
            const markerR = isSelected ? 4 : 3;
            return (
              <Circle
                key={`pt-part-${d}`}
                cx={geometry.x(i)}
                cy={geometry.y(c.partial)}
                r={markerR}
                fill={warningColor}
                stroke={cardColor}
                strokeWidth={1.5}
              />
            );
          })}
          {dates.map((d, i) => {
            const c = counts.get(d) ?? { completed: 0, partial: 0 };
            const isSelected = d === selectedDate;
            const markerR = isSelected ? 4 : 3;
            return (
              <Circle
                key={`pt-done-${d}`}
                cx={geometry.x(i)}
                cy={geometry.y(c.completed)}
                r={markerR}
                fill={successColor}
                stroke={cardColor}
                strokeWidth={1.5}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDotDashed: {
    borderRadius: 2,
    opacity: 0.85,
  },
  legendLabel: { fontSize: 11, marginRight: 6 },
  pendingChart: { height: CHART_HEIGHT, borderRadius: 12, opacity: 0.3, backgroundColor: 'transparent' },
  fallbackText: { fontSize: 12 },
});
