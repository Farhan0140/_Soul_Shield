/** Mirrors soul-shield/repo/sync.go's JSON shapes field-for-field (Go's
 * `omitempty` becomes an optional TS field here). Every relationship is
 * already resolved to a uuid server-side - see that file's comments for
 * why. These are the *wire* shapes; lib/db/schema.ts's columns are the
 * on-device shapes, converted at the repo boundary (lib/db/*-repo.ts). */

export interface SyncTask {
  uuid: string;
  title: string;
  description?: string;
  is_global: boolean;
  recurrence_type: string;
  recurrence_days: number[];
  is_active: boolean;
  category_uuid?: string;
  reward_text?: string;
  task_type: string;
  target_count?: number;
  duration_seconds?: number;
  reminder_time?: string;
  source_task_uuid?: string;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SyncCategory {
  uuid: string;
  name: string;
  color_hex: string;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SyncSubTask {
  uuid: string;
  parent_task_uuid: string;
  title: string;
  task_type: string;
  target_count?: number;
  duration_seconds?: number;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SyncTaskCompletion {
  uuid: string;
  task_uuid?: string;
  task_date: string;
  status: string;
  progress_count: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SyncSubTaskCompletion {
  uuid: string;
  sub_task_uuid?: string;
  parent_task_uuid: string;
  task_date: string;
  status: string;
  progress_count: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SyncSnapshot {
  cursor: string;
  tasks: SyncTask[];
  categories: SyncCategory[];
  sub_tasks: SyncSubTask[];
  task_completions: SyncTaskCompletion[];
  sub_task_completions: SyncSubTaskCompletion[];
}
