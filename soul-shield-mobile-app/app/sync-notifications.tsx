import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useSyncNotifications } from '@/context/sync-notifications-context';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function SyncNotificationsScreen() {
  const { items, dismiss, dismissAll, retry } = useSyncNotifications();
  const dangerColor = useThemeColor({}, 'danger');
  const missedTint = useThemeColor({}, 'missedTint');
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {items.length === 0 ? (
        <EmptyState icon="tray" title="No sync issues" message="Everything is up to date." />
      ) : (
        <>
          <PrimaryButton label="Clear all" variant="secondary" onPress={dismissAll} />
          <View style={styles.list}>
            {items.map((item) => (
              <View key={item.id} style={[styles.row, { backgroundColor: missedTint }]}>
                <View style={styles.rowHeader}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={20} color={dangerColor} />
                  <ThemedText style={[styles.timestamp, { color: mutedColor }]}>
                    {new Date(item.failedAt).toLocaleString()}
                  </ThemedText>
                </View>
                <ThemedText selectable style={[styles.message, { color: dangerColor }]}>
                  {item.errorMessage}
                </ThemedText>
                <View style={styles.actions}>
                  <PrimaryButton label="Retry" variant="secondary" onPress={() => retry(item.id)} />
                  <PrimaryButton label="Dismiss" variant="secondary" onPress={() => dismiss(item.id)} />
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 16 },
  list: { gap: 12 },
  row: { gap: 10, padding: 16, borderRadius: 14, borderCurve: 'continuous' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timestamp: { fontSize: 12 },
  message: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
});
