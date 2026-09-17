import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Local-first SQLite schema — mirrors the backend's sync-enabled tables
 * (soul-shield's migrations 000018-000020 + repo/sync.go) one-for-one, but
 * keyed entirely by `uuid` (TEXT PRIMARY KEY): there is no server-internal
 * bigint id anywhere in this file, and no `owner_id` either — this
 * database belongs to whichever single user is signed into this device, so
 * every row here already implicitly belongs to them.
 *
 * `updatedAt`/`deletedAt` match the server's meaning exactly (soft delete,
 * last-write-wins comparison — see lib/background-sync/pull.ts). `syncedAt`
 * is local-only: null means "written on this device since the last
 * successful push," non-null means "the server has confirmed this exact
 * version." Phase 5 (see the local-first plan) is what points the app's
 * actual read/write hooks at these tables — nothing reads from this schema
 * yet.
 *
 * SQLite has no native array/boolean/timestamp type: `recurrenceDays` is
 * stored as a JSON-encoded string (see lib/db/json-array.ts), booleans use
 * Drizzle's `{ mode: 'boolean' }` integer column, and every timestamp is a
 * plain ISO 8601 string — the same RFC3339 format the backend already
 * sends over the wire, so no conversion is needed either direction. */

export const categories = sqliteTable('categories', {
  uuid: text('uuid').primaryKey(),
  name: text('name').notNull(),
  colorHex: text('color_hex').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncedAt: text('synced_at'),
});

export const tasks = sqliteTable('tasks', {
  uuid: text('uuid').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  isGlobal: integer('is_global', { mode: 'boolean' }).notNull().default(false),
  recurrenceType: text('recurrence_type').notNull(),
  /** JSON-encoded number[] (0=Sunday..6=Saturday) - see lib/db/json-array.ts. */
  recurrenceDays: text('recurrence_days').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  categoryUuid: text('category_uuid').references(() => categories.uuid),
  rewardText: text('reward_text'),
  taskType: text('task_type').notNull(),
  targetCount: integer('target_count'),
  durationSeconds: integer('duration_seconds'),
  reminderTime: text('reminder_time'),
  sourceTaskUuid: text('source_task_uuid'),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncedAt: text('synced_at'),
});

export const subTasks = sqliteTable('sub_tasks', {
  uuid: text('uuid').primaryKey(),
  parentTaskUuid: text('parent_task_uuid')
    .notNull()
    .references(() => tasks.uuid),
  title: text('title').notNull(),
  taskType: text('task_type').notNull(),
  targetCount: integer('target_count'),
  durationSeconds: integer('duration_seconds'),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncedAt: text('synced_at'),
});

export const taskCompletions = sqliteTable('task_completions', {
  uuid: text('uuid').primaryKey(),
  // Nullable to mirror the backend's historical rows from before soft
  // delete existed, where a hard-deleted task's completions kept a NULL
  // task_id (ON DELETE SET NULL) instead of losing the row.
  taskUuid: text('task_uuid').references(() => tasks.uuid),
  taskDate: text('task_date').notNull(),
  status: text('status').notNull(),
  progressCount: integer('progress_count').notNull().default(0),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncedAt: text('synced_at'),
});

export const subTaskCompletions = sqliteTable('sub_task_completions', {
  uuid: text('uuid').primaryKey(),
  subTaskUuid: text('sub_task_uuid').references(() => subTasks.uuid),
  parentTaskUuid: text('parent_task_uuid')
    .notNull()
    .references(() => tasks.uuid),
  taskDate: text('task_date').notNull(),
  status: text('status').notNull(),
  progressCount: integer('progress_count').notNull().default(0),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncedAt: text('synced_at'),
});

/** Single-row table (id is always 1) holding the last successful pull
 * cursor - see lib/background-sync/pull.ts. Absent/null cursor means
 * "never synced, pull everything." */
export const syncState = sqliteTable('sync_state', {
  id: integer('id').primaryKey(),
  cursor: text('cursor'),
});

/** Local-only, never synced to the server - see lib/db/conflicts-repo.ts
 * (added in Phase 4 of the local-first plan). Declared here now so the
 * initial schema migration (lib/db/migrations.ts) only ever needs to run
 * once for this whole table set instead of needing a second migration
 * immediately after. */
export const syncConflicts = sqliteTable('sync_conflicts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  resource: text('resource').notNull(),
  rowUuid: text('row_uuid').notNull(),
  localData: text('local_data').notNull(),
  serverData: text('server_data').notNull(),
  detectedAt: text('detected_at').notNull(),
});
