import { useQueryClient } from '@tanstack/react-query';
import * as ExpoNotifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { deletePushToken, registerPushToken } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { ArabicFontPicker } from '@/components/profile/arabic-font-picker';
import { ThemePicker } from '@/components/profile/theme-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useLocale, type Locale } from '@/context/locale-context';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { cancelDailyDigest, scheduleDailyDigest } from '@/lib/notifications';
import {
  clearRegisteredPushToken,
  getDigestPref,
  getPushPref,
  getRegisteredPushToken,
  setDigestEnabled as persistDigestEnabled,
  setDigestTime as persistDigestTime,
  setPushPref,
  setRegisteredPushToken,
} from '@/lib/notification-prefs';
import { getBackgroundSyncState, type BackgroundSyncState } from '@/lib/background-sync/state';
import { runFullBackgroundSync } from '@/lib/background-sync/sync';
import { tokenStore } from '@/lib/secure-store';
import { checkConflictDetection } from '@/lib/db/conflict-check';
import { checkDerivedTasksAgainstServer } from '@/lib/db/contract-check';
import { addDays, dateRange, todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';
import { shareExport } from '@/lib/export';
import { clearOfflineCache, countPendingMutations } from '@/lib/persister';

/** Resolves the EAS projectId app.json carries (extra.eas.projectId) —
 * required by getExpoPushTokenAsync on SDK 53+. */
function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { locale, setLocale, t } = useLocale();
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');

  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncState, setSyncState] = useState<BackgroundSyncState | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);
  const [checkingLocalDb, setCheckingLocalDb] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [showDigestPicker, setShowDigestPicker] = useState(false);
  const [digestEnabled, setDigestEnabledState] = useState(false);
  const [digestTime, setDigestTimeState] = useState({ hour: 20, minute: 0 });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const refreshSyncState = useCallback(() => {
    getBackgroundSyncState().then(setSyncState);
  }, []);

  useEffect(() => {
    refreshSyncState();
    getDigestPref().then((pref) => {
      setDigestEnabledState(pref.enabled);
      setDigestTimeState({ hour: pref.hour, minute: pref.minute });
    });
    getPushPref().then(setPushEnabled);
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

  // ---- End-of-day digest (#12): toggle + time, (re)scheduled immediately ----
  const handleDigestToggle = async (enabled: boolean) => {
    setDigestEnabledState(enabled);
    await persistDigestEnabled(enabled);
    if (enabled) await scheduleDailyDigest(digestTime.hour, digestTime.minute);
    else await cancelDailyDigest();
  };

  const handleDigestTime = (_event: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setShowDigestPicker(false);
    if (!selected) return;
    const hour = selected.getHours();
    const minute = selected.getMinutes();
    setDigestTimeState({ hour, minute });
    persistDigestTime(hour, minute).catch(() => {});
    if (digestEnabled) scheduleDailyDigest(hour, minute).catch(() => {});
  };

  // ---- Cross-device sync alerts (#19): register/remove the Expo push token ----
  const handlePushToggle = async (enabled: boolean) => {
    setPushEnabled(enabled);
    setPushBusy(true);
    try {
      if (enabled) {
        const permission = await ExpoNotifications.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            t('profile.data.syncAlerts'),
            'Notifications are disabled for Soul Shield in system settings.'
          );
          setPushEnabled(false);
          return;
        }
        const projectId = getExpoProjectId();
        const tokenResult = await ExpoNotifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        const token =
          typeof tokenResult.data === 'string' ? tokenResult.data : String(tokenResult.data ?? '');
        await registerPushToken(token, Platform.OS, await tokenStore.getToken());
        await setRegisteredPushToken(token, Platform.OS);
      } else {
        const previous = await getRegisteredPushToken();
        if (!previous) return;
        await deletePushToken(previous, await tokenStore.getToken());
        await clearRegisteredPushToken();
      }
      await setPushPref(enabled);
    } catch (err) {
      setPushEnabled(!enabled);
      Alert.alert(t('profile.data.syncAlerts'), getErrorMessage(err));
    } finally {
      setPushBusy(false);
    }
  };

  const handleCheckLocalDb = async () => {
    setCheckingLocalDb(true);
    try {
      const dates = dateRange(todayISODate(), addDays(todayISODate(), 3));
      const result = await checkDerivedTasksAgainstServer(dates);
      Alert.alert('Local DB Contract Check', result);
    } catch (err) {
      Alert.alert('Local DB Contract Check Failed', getErrorMessage(err));
    } finally {
      setCheckingLocalDb(false);
    }
  };

  const handleCheckConflictDetection = () => {
    setCheckingConflict(true);
    try {
      const result = checkConflictDetection();
      Alert.alert('Conflict Detection Check', result);
    } catch (err) {
      Alert.alert('Conflict Detection Check Failed', getErrorMessage(err));
    } finally {
      setCheckingConflict(false);
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

  const handleExport = async () => {
    setExporting(true);
    try {
      await shareExport();
    } catch (err) {
      Alert.alert(t('profile.data.export'), getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  /** #4: explicit logout wipes this device's local store — if any offline
   * edits are still queued, say so LOUDLY before they're lost. Auto-logout
   * (expired token) keeps local data instead (see auth-context). */
  const handleLogout = () => {
    const pending = countPendingMutations(queryClient);
    const message =
      pending > 0 ? t('profile.logoutWithPending') : t('profile.logoutConfirm');

    Alert.alert(t('profile.logoutConfirm'), message, [
      { text: t('common.dismiss'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: () => {
          // Best-effort: drop this device's push token so the server stops
          // sending data-change pushes to a logged-out phone.
          (async () => {
            const previous = await getRegisteredPushToken();
            if (previous) {
              await deletePushToken(previous, await tokenStore.getToken()).catch(() => {});
            }
            await clearRegisteredPushToken().catch(() => {});
          })()
            .catch(() => {})
            .finally(() => logout());
        },
      },
    ]);
  };

  const toolRows: { icon: Parameters<typeof IconSymbol>[0]['name']; label: string; onPress: () => void }[] = [
    { icon: 'clock', label: t('profile.tools.timer'), onPress: () => router.push('/timer') },
    { icon: 'line.3.horizontal', label: t('profile.tools.reorder'), onPress: () => router.push('/reorder') },
    { icon: 'sparkles', label: t('profile.tools.insights'), onPress: () => router.push('/insights' as never) },
    { icon: 'checklist', label: t('profile.tools.search'), onPress: () => router.push('/search' as never) },
    { icon: 'folder.fill', label: t('profile.tools.archived'), onPress: () => router.push('/archived' as never) },
  ];

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
            {t('profile.appearance')}
          </ThemedText>
        </View>
        <ThemePicker />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="globe" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.language')}
          </ThemedText>
        </View>
        <View style={styles.languageRow}>
          {(['en', 'bn'] as Locale[]).map((candidate) => (
            <Pressable
              key={candidate}
              onPress={() => setLocale(candidate)}
              style={({ pressed }) => [
                styles.languageChip,
                {
                  backgroundColor: locale === candidate ? `${tintColor}1A` : cardColor,
                  borderColor: locale === candidate ? tintColor : `${mutedColor}55`,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <ThemedText
                type="defaultSemiBold"
                style={{ color: locale === candidate ? tintColor : mutedColor, fontSize: 13 }}>
                {candidate === 'en' ? t('profile.language.en') : t('profile.language.bn')}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="textformat" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.arabicFont')}
          </ThemedText>
        </View>
        <ArabicFontPicker />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="bell.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.notifications')}
          </ThemedText>
        </View>

        <View style={styles.switchRow}>
          <ThemedText type="defaultSemiBold" style={styles.switchLabel}>
            {t('profile.data.dailyDigest')}
          </ThemedText>
          <Switch value={digestEnabled} onValueChange={(v) => void handleDigestToggle(v)} />
        </View>
        {digestEnabled ? (
          <>
            <Pressable
              onPress={() => setShowDigestPicker(true)}
              style={({ pressed }) => [
                styles.digestTimeButton,
                { backgroundColor: cardColor, opacity: pressed ? 0.8 : 1 },
              ]}>
              <ThemedText style={{ color: mutedColor }}>{t('profile.digestTimeLabel')}</ThemedText>
              <ThemedText type="defaultSemiBold">
                {String(digestTime.hour).padStart(2, '0')}:{String(digestTime.minute).padStart(2, '0')}
              </ThemedText>
            </Pressable>
            {showDigestPicker ? (
              <DateTimePicker
                value={new Date(2000, 0, 1, digestTime.hour, digestTime.minute)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDigestTime}
              />
            ) : null}
          </>
        ) : null}

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <ThemedText type="defaultSemiBold">{t('profile.data.syncAlerts')}</ThemedText>
            <ThemedText style={{ color: mutedColor }}>{t('profile.data.syncAlertsHint')}</ThemedText>
          </View>
          <Switch value={pushEnabled} disabled={pushBusy} onValueChange={(v) => void handlePushToggle(v)} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="clock" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.tools')}
          </ThemedText>
        </View>
        {toolRows.map((row) => (
          <Pressable
            key={row.label}
            onPress={row.onPress}
            style={({ pressed }) => [styles.toolRow, { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={row.label}>
            <View style={[styles.toolIconCircle, { backgroundColor: `${tintColor}1A` }]}>
              <IconSymbol name={row.icon} size={22} color={tintColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={styles.toolLabel}>
              {row.label}
            </ThemedText>
            <IconSymbol name="chevron.right" size={18} color={mutedColor} />
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="externaldrive.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.data')}
          </ThemedText>
        </View>
        <ThemedText style={[styles.syncStatus, { color: mutedColor }]}>{formatSyncStatus(syncState)}</ThemedText>
        <PrimaryButton label={t('profile.data.export')} variant="secondary" loading={exporting} onPress={handleExport} />
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
        {__DEV__ ? (
          <PrimaryButton
            label="Check Local DB vs Server (dev)"
            variant="secondary"
            loading={checkingLocalDb}
            onPress={handleCheckLocalDb}
          />
        ) : null}
        {__DEV__ ? (
          <PrimaryButton
            label="Check Conflict Detection (dev)"
            variant="secondary"
            loading={checkingConflict}
            onPress={handleCheckConflictDetection}
          />
        ) : null}
      </View>

      <PrimaryButton label={t('profile.logout')} variant="destructive" onPress={handleLogout} />
    </ScrollView>
  );
}

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
  languageRow: { flexDirection: 'row', gap: 10 },
  languageChip: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { flex: 1, gap: 2 },
  digestTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
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
