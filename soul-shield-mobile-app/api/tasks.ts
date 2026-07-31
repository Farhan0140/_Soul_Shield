import { apiDelete, apiGet, apiPatch, apiPost } from '@/api/client';
import type {
  CompletionResponse,
  SubTaskCompletionResponse,
  Task,
  TaskInput,
  TaskMutationResponse,
  TaskUpdateInput,
} from '@/api/types';

export function getTasks(date: string, token: string | null) {
  return apiGet<Task[]>(`/tasks?date=${date}`, token);
}

export function getTaskHistory(from: string, to: string, token: string | null) {
  return apiGet<Task[]>(`/tasks/history?from=${from}&to=${to}`, token);
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

export function completeTask(id: number, date: string | undefined, token: string | null) {
  return apiPost<CompletionResponse>(`/tasks/${id}/complete`, date ? { date } : {}, token);
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
