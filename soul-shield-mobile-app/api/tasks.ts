import { apiGet, apiPost, type RetryOptions } from '@/api/client';
import type { AddToMyTasksResponse, ManageableTask, SubTask, Task } from '@/api/types';

// Wire shapes of the REST read endpoints. Each numeric id (`task_id`,
// `category_id`, `sub_task_id`, `id`) is what the web client
// (soul-shield-client) reads, so the backend keeps it unchanged and adds a
// `*_uuid` field alongside; the mobile app's types use the uuid everywhere
// (see api/types.ts), so every reader below maps onto the uuid fields
// explicitly rather than trusting a raw type cast.
type SubTaskWire = Omit<SubTask, 'sub_task_id'> & { sub_task_id: number; sub_task_uuid: string };
type TaskWire = Omit<Task, 'task_id' | 'category_id' | 'sub_tasks'> & {
  task_id: number;
  task_uuid: string;
  category_id?: number | null;
  category_uuid?: string | null;
  sub_tasks?: SubTaskWire[];
};
interface ManageableSubTaskWire {
  sub_task_id: number;
  sub_task_uuid: string;
  title: string;
  task_type: Task['task_type'];
  target_count: number | null;
  duration_seconds: number | null;
}
interface ManageableTaskWire {
  id: number;
  uuid: string;
  title: string;
  category_id?: number;
  category_uuid?: string;
  position: number;
  sub_tasks?: ManageableSubTaskWire[];
}

function mapTask(t: TaskWire): Task {
  const { task_uuid, category_uuid, sub_tasks, ...rest } = t;
  return {
    ...rest,
    task_id: task_uuid,
    category_id: category_uuid ?? null,
    sub_tasks: sub_tasks?.map(({ sub_task_uuid, ...s }) => ({ ...s, sub_task_id: sub_task_uuid })),
  };
}

// Read-only network fallback, used only while the on-device SQLite store
// isn't available yet (see lib/db/client.ts's getLocalDb - most likely
// right after this app version first ships, before the required native
// rebuild has happened on this device). Once local-first reads are live,
// these exist purely as that transitional safety net so the app shows real
// data instead of an empty list, not as the normal path — see
// hooks/queries/use-tasks.ts.
export async function getTasks(date: string, token: string | null, timeoutMs?: number): Promise<Task[]> {
  const wire = await apiGet<TaskWire[]>(`/tasks?date=${date}`, token, timeoutMs);
  return wire.map(mapTask);
}

export async function getTaskHistory(
  from: string,
  to: string,
  token: string | null,
  timeoutMs?: number
): Promise<Task[]> {
  const wire = await apiGet<TaskWire[]>(`/tasks/history?from=${from}&to=${to}`, token, timeoutMs);
  return wire.map(mapTask);
}

export async function getMyTasks(token: string | null): Promise<ManageableTask[]> {
  const wire = await apiGet<ManageableTaskWire[]>('/tasks/mine', token);
  return wire.map((t) => ({
    id: t.uuid,
    title: t.title,
    category_id: t.category_uuid,
    position: t.position,
    sub_tasks: t.sub_tasks?.map((s) => ({
      sub_task_id: s.sub_task_uuid,
      title: s.title,
      task_type: s.task_type,
      target_count: s.target_count,
      duration_seconds: s.duration_seconds,
    })),
  }));
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
