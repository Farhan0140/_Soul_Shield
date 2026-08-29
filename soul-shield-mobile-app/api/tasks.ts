import { apiDelete, apiGet, apiPatch, apiPost } from '@/api/client';
import type {
  AddToMyTasksResponse,
  CompletionResponse,
  ManageableTask,
  SubTaskCompletionResponse,
  Task,
  TaskInput,
  TaskMutationResponse,
  TaskUpdateInput,
} from '@/api/types';

export function getTasks(date: string, token: string | null, timeoutMs?: number) {
  return apiGet<Task[]>(`/tasks?date=${date}`, token, timeoutMs);
}

export function getTaskHistory(from: string, to: string, token: string | null, timeoutMs?: number) {
  return apiGet<Task[]>(`/tasks/history?from=${from}&to=${to}`, token, timeoutMs);
}

/** Every personal task, unfiltered by date/recurrence — powers the
 * dedicated Reorder page (app/reorder/*), which needs the complete
 * category/task set the reorder endpoints validate against, not just
 * today's scheduled subset. */
export function getMyTasks(token: string | null) {
  return apiGet<ManageableTask[]>('/tasks/mine', token);
}

export function createTask(input: TaskInput, token: string | null) {
  return apiPost<TaskMutationResponse>('/tasks', input, token);
}

export function updateTask(id: number, input: TaskUpdateInput, token: string | null) {
  return apiPatch<TaskMutationResponse>(`/tasks/${id}`, input, token);
}

export function deleteTask(id: number, token: string | null) {
  return apiDelete<void>(`/tasks/${id}`, token);
}

/** Sets the caller's personal task display order within one category
 * (categoryId=null for "Uncategorized"). orderedIds must be the complete
 * set of that category's current personal task ids, in the desired order. */
export function reorderTasks(
  categoryId: number | null,
  orderedIds: number[],
  token: string | null
) {
  return apiPatch<TaskMutationResponse[]>(
    '/tasks/reorder',
    { category_id: categoryId, ordered_ids: orderedIds },
    token
  );
}

export function completeTask(id: number, date: string | undefined, token: string | null) {
  return apiPost<CompletionResponse>(`/tasks/${id}/complete`, date ? { date } : {}, token);
}

export function addTaskToMyTasks(id: number, token: string | null) {
  return apiPost<AddToMyTasksResponse>(`/tasks/${id}/add-to-my-tasks`, {}, token);
}

export function incrementTask(
  id: number,
  amount: number,
  date: string | undefined,
  token: string | null
) {
  return apiPost<CompletionResponse>(
    `/tasks/${id}/increment`,
    date ? { amount, date } : { amount },
    token
  );
}

export function completeSubTask(
  taskId: number,
  subTaskId: number,
  date: string | undefined,
  token: string | null
) {
  return apiPost<SubTaskCompletionResponse>(
    `/tasks/${taskId}/subtasks/${subTaskId}/complete`,
    date ? { date } : {},
    token
  );
}

export function incrementSubTask(
  taskId: number,
  subTaskId: number,
  amount: number,
  date: string | undefined,
  token: string | null
) {
  return apiPost<SubTaskCompletionResponse>(
    `/tasks/${taskId}/subtasks/${subTaskId}/increment`,
    date ? { amount, date } : { amount },
    token
  );
}
