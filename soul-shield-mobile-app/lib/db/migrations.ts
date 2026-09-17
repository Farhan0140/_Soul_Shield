import type { SQLiteDatabase } from 'expo-sqlite';

/** Hand-written, numbered SQL migrations tracked via SQLite's own
 * `PRAGMA user_version` — deliberately not drizzle-kit's generate+migrator
 * pipeline (which needs a babel/metro SQL-file-import plugin wired into
 * this project's bundler config just to load .sql migration files at
 * runtime). Drizzle is still used for everything else - schema types and
 * the query builder (see lib/db/schema.ts, lib/db/client.ts) - this file
 * only replaces its migration *runner*. Mirrors the backend's own
 * `NNN_name.sql` numbered-migration convention (soul-shield/migrations/),
 * just with the whole set for one version living in one string instead of
 * separate up/down files - there's no rollback story on-device, the app
 * always migrates forward.
 *
 * Add a new entry (never edit an existing one) when the schema changes -
 * each one runs at most once per device, in order, inside its own
 * transaction. */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE categories (
        uuid TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color_hex TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT
      );

      CREATE TABLE tasks (
        uuid TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        is_global INTEGER NOT NULL DEFAULT 0,
        recurrence_type TEXT NOT NULL,
        recurrence_days TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        category_uuid TEXT REFERENCES categories(uuid),
        reward_text TEXT,
        task_type TEXT NOT NULL,
        target_count INTEGER,
        duration_seconds INTEGER,
        reminder_time TEXT,
        source_task_uuid TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT
      );
      CREATE INDEX idx_tasks_category_uuid ON tasks(category_uuid);
      CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at);

      CREATE TABLE sub_tasks (
        uuid TEXT PRIMARY KEY NOT NULL,
        parent_task_uuid TEXT NOT NULL REFERENCES tasks(uuid),
        title TEXT NOT NULL,
        task_type TEXT NOT NULL,
        target_count INTEGER,
        duration_seconds INTEGER,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT
      );
      CREATE INDEX idx_sub_tasks_parent_task_uuid ON sub_tasks(parent_task_uuid);

      CREATE TABLE task_completions (
        uuid TEXT PRIMARY KEY NOT NULL,
        task_uuid TEXT REFERENCES tasks(uuid),
        task_date TEXT NOT NULL,
        status TEXT NOT NULL,
        progress_count INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT
      );
      CREATE INDEX idx_task_completions_task_date ON task_completions(task_uuid, task_date);

      CREATE TABLE sub_task_completions (
        uuid TEXT PRIMARY KEY NOT NULL,
        sub_task_uuid TEXT REFERENCES sub_tasks(uuid),
        parent_task_uuid TEXT NOT NULL REFERENCES tasks(uuid),
        task_date TEXT NOT NULL,
        status TEXT NOT NULL,
        progress_count INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT
      );
      CREATE INDEX idx_sub_task_completions_sub_task_date ON sub_task_completions(sub_task_uuid, task_date);

      CREATE TABLE sync_state (
        id INTEGER PRIMARY KEY NOT NULL,
        cursor TEXT
      );

      CREATE TABLE sync_conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        resource TEXT NOT NULL,
        row_uuid TEXT NOT NULL,
        local_data TEXT NOT NULL,
        server_data TEXT NOT NULL,
        detected_at TEXT NOT NULL
      );
    `,
  },
];

export function runMigrations(db: SQLiteDatabase): void {
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    db.execSync('BEGIN TRANSACTION');
    try {
      db.execSync(migration.sql);
      db.execSync(`PRAGMA user_version = ${migration.version}`);
      db.execSync('COMMIT');
    } catch (error) {
      db.execSync('ROLLBACK');
      throw error;
    }
  }
}
