import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { formatRemaining } from '@/lib/timer/format';

const CHANNEL_ID = 'timer-task';
const RUNNING_NOTIFICATION_ID_PREFIX = 'soulshield-timer-task-running-';
const COMPLETION_NOTIFICATION_ID_KEY_PREFIX = 'soulshield_timer_task_completion_notification_id_';

/** Marks a notification as belonging to a specific Timer Task run — distinct
 * from the Profile Timer's `{ type: 'timer' }` (lib/timer/notifications.ts)
 * so the two features never collide on AsyncStorage keys or notification
 * identifiers, and so lib/notifications.ts's shared handler can recognize
 * both. Carries enough to route a notification tap back to the right
 * dedicated page (see app/_layout.tsx's response listener). */
export function timerTaskNotificationData(taskId: number, subTaskId: number | null, date: string) {
  return { type: 'timer-task' as const, taskId, subTaskId, date };
}

function runningNotificationId(taskId: number, subTaskId: number | null, date: string): string {
  return `${RUNNING_NOTIFICATION_ID_PREFIX}${taskId}_${subTaskId ?? 'main'}_${date}`;
}

function completionNotificationIdKey(taskId: number, subTaskId: number | null, date: string): string {
  return `${COMPLETION_NOTIFICATION_ID_KEY_PREFIX}${taskId}_${subTaskId ?? 'main'}_${date}`;
}

/** Silent, vibration-only channel — separate from the Profile Timer's own
 * `timer` channel and from task reminders' `task-reminders` channel (which
 * plays sound). Idempotent, call once at app startup. */
export async function ensureTimerTaskNotificationChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Timer Task',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: true,
    vibrationPattern: [0, 300, 150, 300, 150, 300],
  });
}

/** Presents (or replaces, via a per-run identifier) the "timer running"
 * notification for one Timer Task run, showing the task name plus remaining
 * time. `sticky: true` maps to Android's `setOngoing()`. Best-effort only:
 * reflects whatever `remainingMs` was passed at call time (start/resume,
 * app-foreground, and a periodic foreground refresh — see
 * hooks/use-task-timer.ts), so its text can lag behind the real countdown
 * while the app is backgrounded for a long stretch. */
export async function showTimerTaskRunningNotification(
  taskId: number,
  subTaskId: number | null,
  date: string,
  taskTitle: string,
  remainingMs: number
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: runningNotificationId(taskId, subTaskId, date),
    content: {
      title: taskTitle,
      body: `${formatRemaining(remainingMs)} remaining`,
      data: timerTaskNotificationData(taskId, subTaskId, date),
      sticky: true,
      autoDismiss: false,
    },
    trigger: null,
  });
}

export async function clearTimerTaskRunningNotification(
  taskId: number,
  subTaskId: number | null,
  date: string
): Promise<void> {
  const id = runningNotificationId(taskId, subTaskId, date);
  await Notifications.dismissNotificationAsync(id).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Schedules the notification that must fire exactly on time regardless of
 * whether the JS thread is even running — the same role
 * scheduleTimerCompletionNotification plays for the Profile Timer, but keyed
 * per Timer Task run so multiple Timer Tasks can each have one scheduled
 * concurrently without clobbering each other. This is what lets the user
 * know their Timer Task finished even if the app is killed at that instant;
 * the actual task-completion API call still happens separately (see
 * hooks/use-task-timer.ts's foreground/resume path, and
 * lib/background-sync/timer-task.ts's opportunistic background path). */
export async function scheduleTimerTaskCompletionNotification(
  taskId: number,
  subTaskId: number | null,
  date: string,
  taskTitle: string,
  fireAt: Date
): Promise<void> {
  await cancelTimerTaskCompletionNotification(taskId, subTaskId, date);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: taskTitle,
      body: "Time's up",
      data: timerTaskNotificationData(taskId, subTaskId, date),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: CHANNEL_ID,
    },
  });
  await AsyncStorage.setItem(completionNotificationIdKey(taskId, subTaskId, date), id);
}

export async function cancelTimerTaskCompletionNotification(
  taskId: number,
  subTaskId: number | null,
  date: string
): Promise<void> {
  const key = completionNotificationIdKey(taskId, subTaskId, date);
  const id = await AsyncStorage.getItem(key);
  if (!id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await AsyncStorage.removeItem(key);
}
