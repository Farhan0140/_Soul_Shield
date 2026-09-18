import { apiGet, apiPost, type RetryOptions } from '@/api/client';
import type { AddToMyTasksResponse, ManageableTask, Task } from '@/api/types';

// Read-only network fallback, used only while the on-device SQLite store
// isn't available yet (see lib/db/client.ts's getLocalDb - most likely
// right after this app version first ships, before the required native
// rebuild has happened on this device). Once local-first reads are live,
// these exist purely as that transitional safety net so the app shows real
// data instead of an empty list, not as the normal path — see
// hooks/queries/use-tasks.ts.
export function getTasks(date: string, token: string | null, timeoutMs?: number) {
  return apiGet<Task[]>(`/tasks?date=${date}`, token, timeoutMs);
}

export function getTaskHistory(from: string, to: string, token: string | null, timeoutMs?: number) {
  return apiGet<Task[]>(`/tasks/history?from=${from}&to=${to}`, token, timeoutMs);
}

export function getMyTasks(token: string | null) {
  return apiGet<ManageableTask[]>('/tasks/mine', token);
}

/** Deliberately still a direct network call, not routed through the
 * local-first sync push (see lib/mutation-defaults.ts) - the backend's
 * add-to-my-tasks does real server-side work no offline device can safely
 * replicate (case-insensitive category-name dedupe/reuse against the
 * user's current category list, "already added" duplicate detection),
 * so it stays an online-only action. Resolves the source fixed task by
 * uuid (see soul-shield's rest/handlers/task/add_to_my_tasks.go's
 * AddToMyTasksByUUID) since the mobile app only ever knows a global task
 * by its uuid, never its server-internal id. */
export function addTaskToMyTasks(sourceTaskUuid: string, token: string | null, retry?: RetryOptions) {
  return apiPost<AddToMyTasksResponse>(`/tasks/by-uuid/${sourceTaskUuid}/add-to-my-tasks`, {}, token, retry);
}
