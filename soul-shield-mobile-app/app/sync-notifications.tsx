import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useSyncNotifications } from '@/context/sync-notifications-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  clearRejectedChanges,
  listRejectedChanges,
  subscribeRejectedChanges,
  type RejectedChange,
} from '@/lib/background-sync/rejected';
import { clearSyncConflicts, listSyncConflicts } from '@/lib/db/conflicts-repo';
import { useLocale } from '@/context/locale-context';

export default function SyncNotificationsScreen() {
  const { items, dismiss, dismissAll, retry } = useSyncNotifications();
  const { t } = useLocale();
  const dangerColor = useThemeColor({}, 'danger');
  const warningColor = useThemeColor({}, 'warning');
  const missedTint = useThemeColor({}, 'missedTint');
  const cardColor = useThemeColor({}, 'card');
  const mutedColor = useThemeColor({}, 'muted');

  const [rejected, setRejected] = useState<RejectedChange[]>(() => listRejectedChanges());
  const [conflicts, setConflicts] = useState(() => listSyncConflicts());

  useEffect(() => {
    const unsub = subscribeRejectedChanges(() => setRejected(listRejectedChanges()));
    return unsub;
  }, []);

  // Conflicts live in SQLite, not an observable store — re-read on every
  // focus/appearance via a lightweight interval-less effect here (screen
  // mount) plus after clear below.
  const reloadConflicts = useCallback(() => setConflicts(listSyncConflicts()), []);
  useEffect(() => {
    reloadConflicts();
  }, [reloadConflicts]);

  const totalIssues = items.length + rejected.length + conflicts.length;

  if (totalIssues === 0) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <EmptyState icon="tray" title={t('sync.noIssues')} message={t('sync.noIssuesMessage')} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {items.length > 0 ? (
        <>
          <SectionHeader label={t('sync.failedRequests')} />
          <PrimaryButton label={t('common.clearAll')} variant="secondary" onPress={dismissAll} />
          <View style={styles.list}>
            {items.map((item) => (
              <View key={item.id} style={[styles.row, { backgroundColor: missedTint }]}>
                <View style={styles.rowTitle}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={20} color={dangerColor} />
                  <ThemedText style={[styles.timestamp, { color: mutedColor }]}>
                    {new Date(item.failedAt).toLocaleString()}
                  </ThemedText>
                </View>
                <ThemedText selectable style={[styles.message, { color: dangerColor }]}>
                  {item.errorMessage}
                </ThemedText>
                <View style={styles.actions}>
                  <PrimaryButton label={t('common.retry')} variant="secondary" onPress={() => retry(item.id)} />
                  <PrimaryButton label={t('common.dismiss')} variant="secondary" onPress={() => dismiss(item.id)} />
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {rejected.length > 0 ? (
        <>
          <SectionHeader label={`${t('sync.rejectedChanges')} (${rejected.length})`} />
          <ThemedText style={[styles.hint, { color: mutedColor }]}>{t('sync.rejectedHint')}</ThemedText>
          <PrimaryButton
            label={t('common.clearAll')}
            variant="secondary"
            onPress={() => {
              clearRejectedChanges();
              setRejected([]);
            }}
          />
          <View style={styles.list}>
            {rejected.map((item) => (
              <View key={`${item.resource}-${item.uuid}`} style={[styles.row, { backgroundColor: cardColor }]}>
                <View style={styles.rowTitle}>
                  <IconSymbol name="xmark.circle.fill" size={18} color={warningColor} />
                  <ThemedText style={[styles.timestamp, { color: mutedColor }]}>
                    {item.resource} · {new Date(item.at).toLocaleString()}
                  </ThemedText>
                </View>
                <ThemedText selectable style={[styles.message, { color: warningColor }]}>
                  {item.error}
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {conflicts.length > 0 ? (
        <>
          <SectionHeader label={`${t('sync.conflicts')} (${conflicts.length})`} />
          <ThemedText style={[styles.hint, { color: mutedColor }]}>{t('sync.conflictsHint')}</ThemedText>
          <PrimaryButton
            label={t('common.clearAll')}
            variant="secondary"
            onPress={() => {
              clearSyncConflicts();
              reloadConflicts();
            }}
          />
          <View style={styles.list}>
            {conflicts.slice(0, 20).map((row) => (
              <View key={row.id} style={[styles.row, { backgroundColor: cardColor }]}>
                <View style={styles.rowTitle}>
                  <IconSymbol name="arrow.counterclockwise" size={18} color={mutedColor} />
                  <ThemedText style={[styles.timestamp, { color: mutedColor }]}>
                    {row.resource} · {new Date(row.detectedAt).toLocaleString()}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function SectionHeader({ label }: { label: string }) {
  const muted = useThemeColor({}, 'muted');
  return (
    <ThemedText type="defaultSemiBold" style={[styles.sectionHeader, { color: muted }]}>
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 14 },
  sectionHeader: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  hint: { fontSize: 12 },
  list: { gap: 12 },
  row: { gap: 10, padding: 16, borderRadius: 14, borderCurve: 'continuous' },
  rowTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timestamp: { fontSize: 12 },
  message: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
});
