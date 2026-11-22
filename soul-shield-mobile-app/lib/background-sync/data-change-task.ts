import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { dataChangeType } from '@/lib/background-sync/data-change-payload';
import { runFullBackgroundSync } from '@/lib/background-sync/sync';
import { queryClient } from '@/lib/query-client';

export const DATA_CHANGE_NOTIFICATION_TASK = 'soulshield-data-change-push';

// Cross-device sync (B5): when tasks change through the web app / REST API, the
// server sends a DATA-ONLY push (no title/body, so nothing is shown to the user)
// with { type: 'data-change' }. Data-only messages never reach the JS
// notification listeners, in the foreground included, so the only way to react
// is a task registered with Notifications.registerTaskAsync. That task runs in
// the foreground, in the background, and (Android headless) when the app was
// killed, so it has to be defined at module scope: this file is imported for
// its side effects by the app entry (index.ts).
TaskManager.defineTask<Notifications.NotificationTaskPayload>(DATA_CHANGE_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || dataChangeType(data) !== 'data-change') return;
  // Single-flight + online/sign-in checks live inside runFullBackgroundSync;
  // failures are recorded there, and the next trigger catches up.
  await runFullBackgroundSync(queryClient).catch(() => {});
});

Notifications.registerTaskAsync(DATA_CHANGE_NOTIFICATION_TASK).catch(() => {
  // Not available (e.g. Expo Go / web): the app still syncs on open and on
  // its periodic background task.
});
