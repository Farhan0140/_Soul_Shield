import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useLocale } from '@/context/locale-context';
import { useDeleteTask, useUpdateTask } from '@/hooks/queries/use-task-mutations';
import { useThemeColor } from '@/hooks/use-theme-color';
import { listArchivedTasksLocal } from '@/lib/db/tasks-repo';
import { todayISODate } from '@/lib/date';

/** Archived ("hidden") tasks (#11): personal tasks whose is_active was turned
 * off from the edit screen. They vanish from every list/dating view but keep
 * their completion history; restore flips is_active back (pushed like any
 * edit), delete soft-deletes permanently-ish (tombstoned, sync-visible). */
export default function ArchivedTasksScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const today = todayISODate();

  const updateTask = useUpdateTask(today);
  const deleteTask = useDeleteTask(today);
  const archivedQuery = useQuery({
    queryKey: ['archivedTasks'],
    queryFn: listArchivedTasksLocal,
    networkMode: 'always',
  });

  const cardColor = useThemeColor({}, 'card');
  const tint = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');

  const inset = () => {
    queryClient.invalidateQueries({ queryKey: ['archivedTasks'] });
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
          <IconSymbol name="chevron.left" size={22} color={tint} />
        </Pressable>
        <ThemedText type="title">{t('archived.title')}</ThemedText>
      </View>

      <ThemedText style={{ color: mutedColor, fontSize: 13 }}>{t('archived.hint')}</ThemedText>

      {(archivedQuery.data ?? []).length === 0 ? (
        <EmptyState icon="tray" title={t('archived.title')} message={t('archived.empty')} />
      ) : (
        <View style={styles.list}>
          {(archivedQuery.data ?? []).map((row) => (
            <View key={row.uuid} style={[styles.row, { backgroundColor: cardColor }]}>
              <View style={styles.rowText}>
                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                  {row.title}
                </ThemedText>
                <ThemedText style={{ color: mutedColor, fontSize: 12 }} numberOfLines={1}>
                  {row.taskType}
                </ThemedText>
              </View>
              <View style={styles.actions}>
                <PrimaryButton
                  label={t('archived.restore')}
                  variant="secondary"
                  onPress={() => {
                    updateTask.mutate({ id: row.uuid, input: { is_active: true } });
                    inset();
                  }}
                />
                <PrimaryButton
                  label="Delete"
                  variant="destructive"
                  onPress={() => {
                    deleteTask.mutate(row.uuid);
                    inset();
                  }}
                />
              </View>
            </View>
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
  list: { gap: 12 },
  row: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  rowText: { gap: 2 },
  actions: { flexDirection: 'row', gap: 12 },
});
