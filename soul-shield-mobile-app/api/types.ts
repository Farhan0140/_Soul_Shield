export interface User {
  id: number;
  full_name: string;
  email: string;
  role: 'user' | 'admin';
}

export interface Category {
  id: number;
  name: string;
  color_hex: string;
}

export type RecurrenceType = 'daily' | 'weekly' | 'custom';
export type TaskType = 'normal' | 'counter';
export type TaskStatus = 'pending' | 'completed' | 'missed';

/** Shape returned by GET /tasks and GET /tasks/history (TaskWithStatusResponse on the backend).
 * Note: recurrence_days is NOT included here — the backend only returns it from the
 * create/update endpoints (see TaskMutationResponse), so it's unknown for list/history items. */
export interface Task {
  task_id: number;
  title: string;
  description?: string | null;
  is_global: boolean;
  recurrence_type: RecurrenceType;
  recurrence_days?: number[];
  date: string;
  status: TaskStatus;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  reward_text?: string | null;
  task_type: TaskType;
  target_count: number | null;
  progress_count: number | null;
  is_active?: boolean;
}

export interface TaskInput {
  title: string;
  description?: string;
  recurrence_type: RecurrenceType;
  recurrence_days: number[];
  is_global: boolean;
  category_id?: number | null;
  reward_text?: string;
  task_type: TaskType;
  target_count?: number;
}

export type TaskUpdateInput = Partial<
  Omit<TaskInput, 'is_global'> & { is_active: boolean }
>;

/** Shape returned by POST /tasks and PATCH /tasks/{id} (TaskResponse on the backend).
 * Note: uses `id`, not `task_id`, and does NOT include category/reward/task_type/target_count —
 * those aren't echoed back by create/update, only by GET /tasks. */
export interface TaskMutationResponse {
  id: number;
  title: string;
  description: string;
  is_global: boolean;
  owner_id?: number | null;
  recurrence_type: RecurrenceType;
  recurrence_days: number[];
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

/** Shape returned by POST /tasks/{id}/complete and POST /tasks/{id}/increment
 * (both reuse CompletionResponse on the backend — note there is no progress_count here). */
export interface CompletionResponse {
  id: number;
  task_id?: number;
  task_title: string;
  date: string;
  status: TaskStatus;
  completed_at?: string;
}
