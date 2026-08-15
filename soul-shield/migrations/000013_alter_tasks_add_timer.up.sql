-- +migrate Up
ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS chk_counter_needs_target,
    DROP CONSTRAINT IF EXISTS tasks_task_type_check;

ALTER TABLE tasks
    ADD COLUMN duration_seconds INT;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN ('normal', 'counter', 'timer'));

ALTER TABLE tasks
    ADD CONSTRAINT chk_task_type_fields CHECK (
        (task_type = 'counter' AND target_count IS NOT NULL AND target_count > 0 AND duration_seconds IS NULL)
        OR (task_type = 'timer' AND duration_seconds IS NOT NULL AND duration_seconds > 0 AND target_count IS NULL)
        OR (task_type = 'normal' AND target_count IS NULL AND duration_seconds IS NULL)
    );

ALTER TABLE sub_tasks
    DROP CONSTRAINT IF EXISTS chk_subtask_counter_needs_target,
    DROP CONSTRAINT IF EXISTS sub_tasks_task_type_check;

ALTER TABLE sub_tasks
    ADD COLUMN duration_seconds INT;

ALTER TABLE sub_tasks
    ADD CONSTRAINT sub_tasks_task_type_check CHECK (task_type IN ('normal', 'counter', 'timer'));

ALTER TABLE sub_tasks
    ADD CONSTRAINT chk_subtask_type_fields CHECK (
        (task_type = 'counter' AND target_count IS NOT NULL AND target_count > 0 AND duration_seconds IS NULL)
        OR (task_type = 'timer' AND duration_seconds IS NOT NULL AND duration_seconds > 0 AND target_count IS NULL)
        OR (task_type = 'normal' AND target_count IS NULL AND duration_seconds IS NULL)
    );
