import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemePicker } from '@/components/profile/theme-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getBackgroundSyncState, type BackgroundSyncState } from '@/lib/background-sync/state';
import { runFullBackgroundSync } from '@/lib/background-sync/sync';
import { clearOfflineCache, countPendingMutations } from '@/lib/persister';

function formatSyncStatus(state: BackgroundSyncState | null): string {
  if (!state) return 'Not synced yet on this device';
  if (state.lastOutcome === 'success' && state.lastSuccessAt) {
    return `Last synced ${new Date(state.lastSuccessAt).toLocaleString()}`;
  }
  const lastGood = state.lastSuccessAt
    ? ` (last success ${new Date(state.lastSuccessAt).toLocaleString()})`
    : '';
  if (state.lastOutcome === 'failed') {
    return `Last attempt failed${lastGood}: ${state.lastErrorMessage ?? 'unknown error'}`;
  }
  if (state.lastOutcome === 'skipped-offline') {
    return `Waiting for a connection to sync${lastGood}`;
  }
  return `Not synced yet${lastGood}`;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');
  const [clearing, setClearing] = useState(false);
  const [syncState, setSyncState] = useState<BackgroundSyncState | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);

  const refreshSyncState = useCallback(() => {
    getBackgroundSyncState().then(setSyncState);
  }, []);

  useEffect(() => {
    refreshSyncState();
  }, [refreshSyncState]);

  const handleRunSyncNow = async () => {
    setSyncingNow(true);
    try {
      await runFullBackgroundSync(queryClient);
    } catch {
      // Failure reason is already recorded and picked up by refreshSyncState below.
    } finally {
      setSyncingNow(false);
      refreshSyncState();
    }
  };

  const handleClearCache = () => {
    const pending = countPendingMutations(queryClient);
    const message =
      pending > 0
        ? `You have ${pending} offline change${pending === 1 ? '' : 's'} that haven't synced yet. Clearing offline data will discard ${pending === 1 ? 'it' : 'them'} instead of sending it. This can't be undone. Continue?`
        : "This clears everything saved on this device for offline use. It'll be re-downloaded next time you're online. This can't be undone. Continue?";

    Alert.alert('Clear Offline Data', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await clearOfflineCache(queryClient);
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: cardColor }]}>
        <IconSymbol name="person.crop.circle.fill" size={56} color={tintColor} />
        <View style={styles.info}>
          <ThemedText type="subtitle">{user?.full_name}</ThemedText>
          <ThemedText>{user?.email}</ThemedText>
          {user?.role === 'admin' ? <ThemedText type="defaultSemiBold">Admin</ThemedText> : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="paintpalette.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Appearance
          </ThemedText>
        </View>
        <ThemePicker />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="clock" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Tools
          </ThemedText>
        </View>
        <Pressable
          onPress={() => router.push('/timer')}
          style={({ pressed }) => [styles.toolRow, { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Timer">
          <View style={[styles.toolIconCircle, { backgroundColor: `${tintColor}1A` }]}>
            <IconSymbol name="clock" size={22} color={tintColor} />
          </View>
          <ThemedText type="defaultSemiBold" style={styles.toolLabel}>
            Timer
          </ThemedText>
          <IconSymbol name="chevron.right" size={18} color={mutedColor} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/reorder')}
          style={({ pressed }) => [styles.toolRow, { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Reorder categories, tasks, and sub-tasks">
          <View style={[styles.toolIconCircle, { backgroundColor: `${tintColor}1A` }]}>
            <IconSymbol name="line.3.horizontal" size={22} color={tintColor} />
          </View>
          <ThemedText type="defaultSemiBold" style={styles.toolLabel}>
            Reorder
          </ThemedText>
          <IconSymbol name="chevron.right" size={18} color={mutedColor} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="externaldrive.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Data
          </ThemedText>
        </View>
        <ThemedText style={[styles.syncStatus, { color: mutedColor }]}>
          {formatSyncStatus(syncState)}
        </ThemedText>
        <PrimaryButton
          label="Clear Offline Data"
          variant="secondary"
          loading={clearing}
          onPress={handleClearCache}
        />
        {__DEV__ ? (
          <PrimaryButton
            label="Run Background Sync Now (dev)"
            variant="secondary"
            loading={syncingNow}
            onPress={handleRunSyncNow}
          />
        ) : null}
      </View>

      <PrimaryButton label="Log Out" variant="destructive" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, paddingBottom: 120, gap: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  info: { gap: 4 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  syncStatus: { fontSize: 13 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  toolIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { flex: 1 },
});
