import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { LogBox } from 'react-native';

import type { Task } from '@/api/types';

const REMINDER_IDS_KEY = 'soulshield_task_reminder_ids';
const CHANNEL_ID = 'task-reminders';

// Importing expo-notifications on Android auto-registers a remote push token
// listener as a module side effect, which Expo Go can't fulfill since SDK 53
// and logs loudly about. This app only uses local scheduled notifications
// (never remote push), so the warning doesn't reflect an actual problem here —
// suppress it rather than let it show as a red box on every load.
LogBox.ignoreLogs(['Android Push notifications']);

// Module-level side effect: controls how a notification is presented while
// the app is in the foreground. Imported for its side effect at the top of
// app/_layout.tsx, same pattern as lib/network.ts.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Requests notification permission (iOS + Android 13+) and creates the
 * Android notification channel reminders are posted to. Call once at app
 * startup — safe to call repeatedly, both operations are idempotent. */
export async function ensureNotificationSetup(): Promise<void> {
  await Notifications.requestPermissionsAsync();
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Task Reminders',
    importance: Notifications.AndroidImportance.MAX,
  });
}

async function getReminderIdMap(): Promise<Record<string, string[]>> {
  const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

async function setReminderIdMap(map: Record<string, string[]>): Promise<void> {
  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(map));
}

/** Cancels any reminders previously scheduled for this task, so re-scheduling
 * (or removing the reminder) never leaves stale duplicates behind. */
export async function cancelTaskReminders(taskId: number): Promise<void> {
  const map = await getReminderIdMap();
  const ids = map[taskId];
  if (!ids?.length) return;

  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  delete map[taskId];
  await setReminderIdMap(map);
}

type ReminderTask = Pick<
  Task,
  'task_id' | 'title' | 'reminder_time' | 'recurrence_days' | 'is_active'
>;

/** (Re)schedules a task's weekly reminder. Always cancels any existing
 * schedule for the task first, so this is safe to call after every
 * create/edit without worrying about duplicates. No-ops if the task has no
 * reminder_time, no recurrence_days (unknown schedule), or is inactive. */
export async function scheduleTaskReminders(task: ReminderTask): Promise<void> {
  await cancelTaskReminders(task.task_id);

  if (!task.reminder_time || task.is_active === false) return;
  const days = task.recurrence_days;
  if (!days || days.length === 0) return;

  const [hourStr, minuteStr] = task.reminder_time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;

  const ids = await Promise.all(
    days.map((day) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Soul Shield',
          body: `Don't forget: ${task.title}`,
          data: { taskId: task.task_id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          // This app's recurrence_days is 0=Sunday...6=Saturday (see create_task.go);
          // Expo's calendar trigger weekday is 1=Sunday...7=Saturday.
          weekday: day + 1,
          hour,
          minute,
          channelId: CHANNEL_ID,
        },
      })
    )
  );

  const map = await getReminderIdMap();
  map[task.task_id] = ids;
  await setReminderIdMap(map);
}

/** Re-syncs reminders for a batch of tasks (e.g. a rolling window fetched at
 * app startup), de-duplicated by task_id since the same task can appear
 * multiple times across a multi-day range. */
export async function syncAllTaskReminders(tasks: ReminderTask[]): Promise<void> {
  const byId = new Map<number, ReminderTask>();
  for (const task of tasks) byId.set(task.task_id, task);
  await Promise.all([...byId.values()].map((task) => scheduleTaskReminders(task)));
}

/** Clears every scheduled reminder — call on logout so a signed-out/switched
 * account doesn't leave another user's reminders behind. */
export async function cancelAllTaskReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(REMINDER_IDS_KEY);
}
