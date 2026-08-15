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
export type TaskStatus = 'pending' | 'completed' | 'missed' | 'partially_completed';

/** A child task under a parent Task — shares the same Normal/Counter behavior
 * but has no schedule, category, reward, or reminder of its own; those all
 * live on the parent. Returned embedded in `Task.sub_tasks` by GET /tasks and
 * GET /tasks/history, with `status` scoped to that list's date. */
export interface SubTask {
  sub_task_id: number;
  title: string;
  task_type: TaskType;
  target_count: number | null;
  progress_count: number | null;
  status: TaskStatus;
}

export interface SubTaskInput {
  /** Present when editing an existing sub-task (matches it for update);
   * omit when adding a new one. */
  id?: number;
  title: string;
  task_type: TaskType;
  target_count?: number;
}

/** Shape returned by GET /tasks and GET /tasks/history (TaskWithStatusResponse on the backend). */
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
  /** "HH:MM" 24-hour local time the task should remind at, on each of its recurrence_days. */
  reminder_time?: string | null;
  /** When present, this task's `status` is derived from these (pending if
   * none are completed, partially_completed if some are, completed if all
   * are) — the task itself can no longer be completed directly. */
  sub_tasks?: SubTask[];
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
  /** "HH:MM" 24-hour, or "" to clear an existing reminder. */
  reminder_time?: string;
  /** Omit/[] for no sub-tasks. On update, sending this replaces the whole
   * list server-side: entries with `id` update that sub-task, entries
   * without `id` are created, and existing sub-tasks not present are
   * deleted (their completion history survives). */
  sub_tasks?: SubTaskInput[];
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
 * (both reuse CompletionResponse on the backend — note there is no progress_count here,
 * only reward_text once the completion reaches 'completed' status). */
export interface CompletionResponse {
  id: number;
  task_id?: number;
  task_title: string;
  date: string;
  status: TaskStatus;
  completed_at?: string;
  reward_text?: string;
}

/** Shape returned by POST /tasks/:taskId/subtasks/:subTaskId/complete and
 * .../increment. `parent_status` reflects the parent's aggregate status right
 * after this action; `parent_reward_text` is only set when it just became
 * 'completed' (i.e. every sub-task is now done) — that's the one moment the
 * reward modal should fire for a sub-tasked parent. */
export interface SubTaskCompletionResponse {
  id: number;
  sub_task_id: number;
  parent_task_id: number;
  sub_task_title: string;
  date: string;
  status: TaskStatus;
  progress_count: number;
  completed_at?: string;
  parent_status: TaskStatus;
  parent_reward_text?: string;
}
