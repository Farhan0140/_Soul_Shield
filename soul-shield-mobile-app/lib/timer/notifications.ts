import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// The standalone Timer (Profile -> Tools) was removed. Timer TASKS are a
// separate feature with their own channel (lib/timer-task/notifications.ts).
// These are what the old Timer left behind on phones that used it.
const LEGACY_CHANNEL_ID = 'timer';
const LEGACY_RUNNING_NOTIFICATION_ID = 'soulshield-timer-running';
const LEGACY_COMPLETION_ID_KEY = 'soulshield_timer_completion_notification_id';
const LEGACY_STATE_KEY = 'soulshield_timer_state';

/** Clears what the removed standalone Timer may have left behind: a pinned
 * "Timer running" notification that couldn't be swiped away (nothing could
 * stop it any more), a pending "Time is up" alert, its saved state, and its
 * notification channel in Android settings. Cheap no-op once done; call at
 * app startup. */
export async function clearRemovedTimerLeftovers(): Promise<void> {
  try {
    const [completionId, state] = await Promise.all([
      AsyncStorage.getItem(LEGACY_COMPLETION_ID_KEY),
      AsyncStorage.getItem(LEGACY_STATE_KEY),
    ]);
    await Notifications.dismissNotificationAsync(LEGACY_RUNNING_NOTIFICATION_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(LEGACY_RUNNING_NOTIFICATION_ID).catch(() => {});
    if (completionId) await Notifications.cancelScheduledNotificationAsync(completionId).catch(() => {});
    if (completionId || state) await AsyncStorage.multiRemove([LEGACY_COMPLETION_ID_KEY, LEGACY_STATE_KEY]);
    await Notifications.deleteNotificationChannelAsync(LEGACY_CHANNEL_ID).catch(() => {});
  } catch {
    // Best effort; tried again next launch.
  }
}
