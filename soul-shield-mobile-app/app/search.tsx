import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TextField } from '@/components/ui/text-field';
import { useLocale } from '@/context/locale-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { decodeIntArray } from '@/lib/db/json-array';
import { searchOwnTasksLocal } from '@/lib/db/tasks-repo';
import { addDays, todayISODate, weekdayIndex } from '@/lib/date';
import { setJumpToDate } from '@/lib/jump-to-date';

type TaskRow = ReturnType<typeof searchOwnTasksLocal>[number];

/** Offline task search (#9): substring match over the local store's personal
 * tasks (title + description). Tapping a result jumps Home to that task's
 * NEXT scheduled date derived from its recurrence_days (today if it's
 * scheduled today), so the user lands somewhere the task actually shows up. */
export default function SearchScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const [queryText, setQueryText] = useState('');

  const cardColor = useThemeColor({}, 'card');
  const tint = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');

  const results = useMemo(() => searchOwnTasksLocal(queryText), [queryText]);

  /** Next date >= today whose weekday is one of the task's recurrence days. */
  const nextScheduledDate = (row: TaskRow): string => {
    const days = decodeIntArray(row.recurrenceDays);
    if (days.length === 0) return todayISODate();
    let cursor = todayISODate();
    for (let i = 0; i < 7; i += 1) {
      if (days.includes(weekdayIndex(cursor))) return cursor;
      cursor = addDays(cursor, 1);
    }
    return todayISODate();
  };

  const handleOpen = (row: TaskRow) => {
    if (row.taskType === 'counter') {
      router.push({ pathname: '/counter/[taskId]', params: { taskId: row.uuid, date: todayISODate() } });
      return;
    }
    if (row.taskType === 'timer') {
      router.push({ pathname: '/timer-task/[taskId]', params: { taskId: row.uuid, date: todayISODate() } });
      return;
    }
    setJumpToDate(nextScheduledDate(row));
    router.push('/(tabs)');
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
          <IconSymbol name="chevron.left" size={22} color={tint} />
        </Pressable>
        <ThemedText type="title">{t('search.title')}</ThemedText>
      </View>

      <TextField
        label={t('search.hint')}
        value={queryText}
        onChangeText={setQueryText}
        placeholder={t('search.placeholder')}
        autoCapitalize="none"
      />

      {queryText.trim().length > 0 && results.length === 0 ? (
        <EmptyState icon="tray" title={t('search.title')} message={t('search.empty')} />
      ) : (
        <View style={styles.list}>
          {results.map((row) => (
            <Pressable
              key={row.uuid}
              onPress={() => handleOpen(row)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: cardColor, opacity: pressed ? 0.8 : 1 },
              ]}>
              <View style={styles.rowText}>
                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                  {row.title}
                </ThemedText>
                {row.description ? (
                  <ThemedText style={{ color: mutedColor, fontSize: 12 }} numberOfLines={2}>
                    {row.description}
                  </ThemedText>
                ) : null}
              </View>
              <View style={[styles.typeChip, { backgroundColor: `${tint}1A` }]}>
                <ThemedText style={{ color: tint, fontSize: 11, fontWeight: '600' }}>
                  {row.taskType}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 60,
    gap: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  rowText: { flex: 1, gap: 2 },
  typeChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
});
