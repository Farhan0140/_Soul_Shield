import { useQueryClient } from '@tanstack/react-query';
import * as ExpoNotifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { deletePushToken } from '@/api/auth';
import { getFeedbackNextAllowedAt, getLastRating } from '@/api/feedback';
import { ThemedText } from '@/components/themed-text';
import { ArabicFontPicker } from '@/components/profile/arabic-font-picker';
import { FeedbackSheet, StarRow, useWaitLabel } from '@/components/profile/feedback-sheet';
import { ThemePicker } from '@/components/profile/theme-picker';
import { UIStylePicker } from '@/components/profile/ui-style-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ThemeDecor } from '@/components/ui/theme-decor';
import { useLocale, type Locale } from '@/context/locale-context';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useSurface } from '@/hooks/use-ui-style';
import { getCounterHapticsPref, setCounterHapticsPref } from '@/lib/haptics-pref';
import { cancelDailyDigest, scheduleDailyDigest, sendTestNotification } from '@/lib/notifications';
import {
  clearRegisteredPushToken,
  getDigestPref,
  getRegisteredPushToken,
  setDigestEnabled as persistDigestEnabled,
  setDigestTime as persistDigestTime,
} from '@/lib/notification-prefs';
import { getBackgroundSyncState, type BackgroundSyncState } from '@/lib/background-sync/state';
import { runFullBackgroundSync } from '@/lib/background-sync/sync';
import { tokenStore } from '@/lib/secure-store';
import { checkConflictDetection } from '@/lib/db/conflict-check';
import { checkDerivedTasksAgainstServer } from '@/lib/db/contract-check';
import { addDays, dateRange, todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';
import { clearOfflineCache, countPendingMutations } from '@/lib/persister';

export default function ProfileScreen() {
  const { user, logout, status } = useAuth();
  // No account (guest mode): everything works locally; signing in only adds
  // backup/sync, so account-only controls are hidden.
  const isGuest = status !== 'signedIn';
  const queryClient = useQueryClient();
  const { locale, setLocale, t } = useLocale();
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');
  const warningColor = useThemeColor({}, 'warning');
  const surface = useSurface();

  const [clearing, setClearing] = useState(false);
  const [syncState, setSyncState] = useState<BackgroundSyncState | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);
  const [checkingLocalDb, setCheckingLocalDb] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [showDigestPicker, setShowDigestPicker] = useState(false);
  const [digestEnabled, setDigestEnabledState] = useState(false);
  const [digestTime, setDigestTimeState] = useState({ hour: 20, minute: 0 });
  const [counterHaptics, setCounterHaptics] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  // Rate & feedback (bottom of the page). myRating = last rating sent from
  // this phone; feedbackRating = stars pre-selected when the sheet opens.
  const [myRating, setMyRating] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  // One feedback per 24 hours: set while this person has to wait.
  const [feedbackNextAt, setFeedbackNextAt] = useState<Date | null>(null);
  const waitLabel = useWaitLabel();

  const refreshSyncState = useCallback(() => {
    getBackgroundSyncState().then(setSyncState);
  }, []);

  useEffect(() => {
    refreshSyncState();
    getDigestPref().then((pref) => {
      setDigestEnabledState(pref.enabled);
      setDigestTimeState({ hour: pref.hour, minute: pref.minute });
    });
    setCounterHaptics(getCounterHapticsPref()); // cached — loaded at module init
    getLastRating().then((r) => setMyRating(r ?? 0));
    getFeedbackNextAllowedAt().then(setFeedbackNextAt);
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

  // ---- Counter vibration (#vibration-toggle): gates hapticLight everywhere ----
  const handleCounterHaptics = async (enabled: boolean) => {
    setCounterHaptics(enabled);
    await setCounterHapticsPref(enabled);
  };

  // ---- Immediate test notification: verifies the notification pipeline in
  // whatever client is running (Expo Go vs dev build) without waiting for the
  // daily time — the digest fires at the SET time, and if that time already
  // passed today, at the same time TOMORROW. ----
  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      const permission = await ExpoNotifications.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('profile.notifications'), t('profile.testNotificationDenied'));
        return;
      }
      await sendTestNotification();
      Alert.alert(t('profile.testNotification'), t('profile.testNotificationSent'));
    } catch (err) {
      Alert.alert(t('profile.notifications'), getErrorMessage(err));
    } finally {
      setSendingTest(false);
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

  const toolRows: {
    icon: Parameters<typeof IconSymbol>[0]['name'];
    label: string;
    onPress: () => void;
  }[] = [
    {
      icon: 'line.3.horizontal',
      label: t('profile.tools.reorder'),
      onPress: () => router.push('/reorder'),
    },
    {
      icon: 'sparkles',
      label: t('profile.tools.insights'),
      onPress: () => router.push('/insights' as never),
    },
    {
      icon: 'checklist',
      label: t('profile.tools.search'),
      onPress: () => router.push('/search' as never),
    },
    {
      icon: 'folder.fill',
      label: t('profile.tools.archived'),
      onPress: () => router.push('/archived' as never),
    },
  ];

  const accountRows: {
    icon: Parameters<typeof IconSymbol>[0]['name'];
    label: string;
    onPress: () => void;
  }[] = [
    {
      icon: 'shield.fill',
      label: t('profile.account.changePassword'),
      onPress: () => router.push('/account/change-password' as never),
    },
    {
      icon: 'trash',
      label: t('profile.account.deleteAccount'),
      onPress: () => router.push('/account/delete-account' as never),
    },
  ];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {isGuest ? (
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: cardColor }, surface('note')]}>
            <ThemeDecor kind="note" />
            <IconSymbol name="person.crop.circle.fill" size={56} color={mutedColor} />
            <View style={[styles.info, styles.guestInfo]}>
              <ThemedText type="subtitle">{t('profile.guest.title')}</ThemedText>
              <ThemedText style={{ color: mutedColor }}>{t('profile.guest.body')}</ThemedText>
            </View>
          </View>
          <PrimaryButton label={t('profile.guest.signIn')} onPress={() => router.push('/(auth)/login')} />
          <PrimaryButton
            label={t('profile.guest.createAccount')}
            variant="secondary"
            onPress={() => router.push('/(auth)/register')}
          />
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: cardColor }, surface('note')]}>
          <ThemeDecor kind="note" />
          <IconSymbol name="person.crop.circle.fill" size={56} color={tintColor} />
          <View style={styles.info}>
            <ThemedText type="subtitle">{user?.full_name}</ThemedText>
            <ThemedText>{user?.email}</ThemedText>
            {user?.role === 'admin' ? <ThemedText type="defaultSemiBold">Admin</ThemedText> : null}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={[styles.sectionHeader, surface('tag')]}>
          <ThemeDecor kind="tag" />
          <IconSymbol name="sparkles" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.uiStyle')}
          </ThemedText>
        </View>
        <UIStylePicker />
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionHeader, surface('tag')]}>
          <ThemeDecor kind="tag" />
          <IconSymbol name="paintpalette.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.appearance')}
          </ThemedText>
        </View>
        <ThemePicker />

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <ThemedText type="defaultSemiBold">{t('profile.counterVibration')}</ThemedText>
            <ThemedText style={{ color: mutedColor }}>{t('profile.counterVibrationHint')}</ThemedText>
          </View>
          <Switch
            value={counterHaptics}
            onValueChange={(v) => void handleCounterHaptics(v)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionHeader, surface('tag')]}>
          <ThemeDecor kind="tag" />
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
                surface('chip'),
                surface('chip') && locale === candidate ? { borderColor: tintColor } : null,
              ]}>
              <ThemeDecor
                kind="chip"
                stroke={locale === candidate ? tintColor : undefined}
                hatch={locale === candidate ? tintColor : undefined}
              />
              <ThemedText
                type="defaultSemiBold"
                style={{
                  color: locale === candidate ? tintColor : mutedColor,
                  fontSize: 13,
                }}>
                {candidate === 'en' ? t('profile.language.en') : t('profile.language.bn')}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionHeader, surface('tag')]}>
          <ThemeDecor kind="tag" />
          <IconSymbol name="textformat" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.arabicFont')}
          </ThemedText>
        </View>
        <ArabicFontPicker />
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionHeader, surface('tag')]}>
          <ThemeDecor kind="tag" />
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
                surface('card'),
              ]}>
              <ThemeDecor kind="card" />
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

        <PrimaryButton
          label={t('profile.testNotification')}
          variant="secondary"
          loading={sendingTest}
          onPress={handleSendTest}
        />
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionHeader, surface('tag')]}>
          <ThemeDecor kind="tag" />
          <IconSymbol name="clock" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.tools')}
          </ThemedText>
        </View>
        {toolRows.map((row) => (
          <Pressable
            key={row.label}
            onPress={row.onPress}
            style={({ pressed }) => [
              styles.toolRow,
              { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 },
              surface('card'),
            ]}
            accessibilityRole="button"
            accessibilityLabel={row.label}>
            <ThemeDecor kind="card" />
            <View style={[styles.toolIconCircle, { backgroundColor: `${tintColor}1A` }, surface('iconCircle')]}>
              <ThemeDecor kind="iconCircle" stroke={tintColor} />
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
        <View style={[styles.sectionHeader, surface('tag')]}>
          <ThemeDecor kind="tag" />
          <IconSymbol name="bag.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.shop')}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => router.push('/shop' as never)}
          style={({ pressed }) => [
            styles.toolRow,
            { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 },
            surface('card'),
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${t('profile.shop.row')}, ${t('shop.comingSoon')}`}>
          <ThemeDecor kind="card" />
          <View style={[styles.toolIconCircle, { backgroundColor: `${tintColor}1A` }, surface('iconCircle')]}>
            <ThemeDecor kind="iconCircle" stroke={tintColor} />
            <IconSymbol name="bag.fill" size={22} color={tintColor} />
          </View>
          <ThemedText type="defaultSemiBold" style={styles.toolLabel} numberOfLines={1}>
            {t('profile.shop.row')}
          </ThemedText>
          <View style={[styles.soonPill, { backgroundColor: `${warningColor}1F` }]}>
            <ThemedText style={[styles.soonPillText, { color: warningColor }]}>{t('shop.comingSoon')}</ThemedText>
          </View>
          <IconSymbol name="chevron.right" size={18} color={mutedColor} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionHeader, surface('tag')]}>
          <ThemeDecor kind="tag" />
          <IconSymbol name="externaldrive.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.data')}
          </ThemedText>
        </View>
        <ThemedText style={[styles.syncStatus, { color: mutedColor }]}>
          {isGuest ? t('profile.data.guestStatus') : formatSyncStatus(syncState)}
        </ThemedText>
        {/* Guests: this would delete their only copy (nothing is on a server
            to re-download), so it's account-only. */}
        {!isGuest ? (
          <PrimaryButton label="Clear Offline Data" variant="secondary" loading={clearing} onPress={handleClearCache} />
        ) : null}
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

      {!isGuest ? (
        <>
          <View style={styles.section}>
            <View style={[styles.sectionHeader, surface('tag')]}>
              <ThemeDecor kind="tag" />
              <IconSymbol name="person.fill" size={16} color={mutedColor} />
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                {t('profile.account')}
              </ThemedText>
            </View>
            {accountRows.map((row) => (
              <Pressable
                key={row.label}
                onPress={row.onPress}
                style={({ pressed }) => [
                  styles.toolRow,
                  { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 },
                  surface('card'),
                ]}
                accessibilityRole="button"
                accessibilityLabel={row.label}>
                <ThemeDecor kind="card" />
                <View style={[styles.toolIconCircle, { backgroundColor: `${tintColor}1A` }, surface('iconCircle')]}>
                  <ThemeDecor kind="iconCircle" stroke={tintColor} />
                  <IconSymbol name={row.icon} size={22} color={tintColor} />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.toolLabel}>
                  {row.label}
                </ThemedText>
                <IconSymbol name="chevron.right" size={18} color={mutedColor} />
              </Pressable>
            ))}
          </View>

          <PrimaryButton label={t('profile.logout')} variant="destructive" onPress={handleLogout} />
        </>
      ) : null}

      {/* Rate & feedback - last on the page, for guests too. */}
      <View style={styles.section}>
        <View style={[styles.sectionHeader, surface('tag')]}>
          <ThemeDecor kind="tag" />
          <IconSymbol name="star.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {t('profile.feedback')}
          </ThemedText>
        </View>
        <View style={[styles.feedbackCard, { backgroundColor: cardColor }, surface('card')]}>
          <ThemeDecor kind="card" />
          <ThemedText type="defaultSemiBold" style={styles.center}>
            {feedbackNextAt
              ? t('profile.feedback.sentToday')
              : myRating > 0
                ? t('profile.feedback.rated')
                : t('profile.feedback.prompt')}
          </ThemedText>
          <StarRow
            value={myRating}
            size={34}
            disabled={!!feedbackNextAt}
            onChange={(n) => {
              setFeedbackRating(n);
              setFeedbackOpen(true);
            }}
          />
          {feedbackNextAt ? (
            <ThemedText style={[styles.center, { color: mutedColor }]}>
              {t('feedback.cooldown').replace('{time}', waitLabel(feedbackNextAt))}
            </ThemedText>
          ) : (
            <Pressable
              onPress={() => {
                setFeedbackRating(myRating);
                setFeedbackOpen(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [styles.feedbackLink, { opacity: pressed ? 0.6 : 1 }]}>
              <IconSymbol name="bubble.left.fill" size={16} color={tintColor} />
              <ThemedText type="defaultSemiBold" style={{ color: tintColor }}>
                {t('profile.feedback.write')}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>

      <FeedbackSheet
        visible={feedbackOpen}
        initialRating={feedbackRating}
        onClose={() => setFeedbackOpen(false)}
        onSubmitted={(rating) => {
          setMyRating(rating);
          getFeedbackNextAllowedAt().then(setFeedbackNextAt);
        }}
        onCooldown={setFeedbackNextAt}
      />
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
  guestInfo: { flex: 1 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  syncStatus: { fontSize: 13 },
  languageRow: { flexDirection: 'row', gap: 10 },
  languageChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
  },
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
  toolIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: { flex: 1 },
  soonPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  soonPillText: { fontSize: 12, fontWeight: '700' },
  feedbackCard: {
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  feedbackLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  center: { textAlign: 'center' },
});
