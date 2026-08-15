import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { formatRemaining } from '@/lib/timer/format';

const CHANNEL_ID = 'timer';
const RUNNING_NOTIFICATION_ID = 'soulshield-timer-running';
const COMPLETION_NOTIFICATION_ID_KEY = 'soulshield_timer_completion_notification_id';

/** Marks a notification as belonging to the timer feature — lib/notifications.ts's
 * shared `setNotificationHandler` reads this to suppress sound for timer
 * notifications specifically, without touching task-reminder notifications'
 * existing (sound-on) behavior. */
export const TIMER_NOTIFICATION_DATA = { type: 'timer' } as const;

/** Silent, vibration-only channel, separate from task reminders'
 * `task-reminders` channel (which plays sound) — DEFAULT importance shows the
 * notification in the shade and still vibrates without an interruptive
 * heads-up banner. Idempotent, call once at app startup alongside the
 * existing ensureNotificationSetup(). */
export async function ensureTimerNotificationChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Timer',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: true,
    vibrationPattern: [0, 300, 150, 300, 150, 300],
  });
}

/** Presents (or replaces, via the fixed identifier) the "timer running"
 * notification. `sticky: true` maps to Android's `setOngoing()` — the closest
 * expo-notifications gets to a true foreground-service pin, so it can't be
 * swiped away while the timer runs. Best-effort only: this reflects whatever
 * `remainingMs` was passed at call time (start/resume, app-foreground, and a
 * ~60s foreground interval — see hooks/use-timer.ts), so its text can lag
 * behind the real countdown while the app is backgrounded for a long stretch. */
export async function showTimerRunningNotification(remainingMs: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: RUNNING_NOTIFICATION_ID,
    content: {
      title: 'Timer running',
      body: `${formatRemaining(remainingMs)} remaining`,
      data: TIMER_NOTIFICATION_DATA,
      sticky: true,
      autoDismiss: false,
    },
    trigger: null,
  });
}

export async function clearTimerRunningNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync(RUNNING_NOTIFICATION_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(RUNNING_NOTIFICATION_ID).catch(() => {});
}

/** Schedules the one thing that must fire exactly on time regardless of
 * whether the JS thread is even running: this is what delivers the
 * completion vibration when the app is backgrounded or killed, since a
 * suspended/killed app can't run a JS interval to notice 00:00:00 itself.
 * While the app is in the foreground, hooks/use-timer.ts instead vibrates
 * directly and cancels this before it ever fires — so in the common case
 * (app open) no notification appears at all, matching "no completion
 * notification message" as closely as the platform allows; it's only the
 * backgrounded/killed fallback path where a minimal, silent notification is
 * unavoidably how Android/iOS deliver the vibration. */
export async function scheduleTimerCompletionNotification(fireAt: Date): Promise<void> {
  await cancelTimerCompletionNotification();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Timer',
      body: 'Time is up',
      data: TIMER_NOTIFICATION_DATA,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: CHANNEL_ID,
    },
  });
  await AsyncStorage.setItem(COMPLETION_NOTIFICATION_ID_KEY, id);
}

export async function cancelTimerCompletionNotification(): Promise<void> {
  const id = await AsyncStorage.getItem(COMPLETION_NOTIFICATION_ID_KEY);
  if (!id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await AsyncStorage.removeItem(COMPLETION_NOTIFICATION_ID_KEY);
}
