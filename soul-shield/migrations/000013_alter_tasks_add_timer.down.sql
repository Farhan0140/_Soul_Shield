-- +migrate Down
ALTER TABLE sub_tasks
    DROP CONSTRAINT IF EXISTS chk_subtask_type_fields,
    DROP CONSTRAINT IF EXISTS sub_tasks_task_type_check,
    DROP COLUMN IF EXISTS duration_seconds;

ALTER TABLE sub_tasks
    ADD CONSTRAINT sub_tasks_task_type_check CHECK (task_type IN ('normal', 'counter'));

ALTER TABLE sub_tasks
    ADD CONSTRAINT chk_subtask_counter_needs_target CHECK (
        (task_type = 'counter' AND target_count IS NOT NULL AND target_count > 0)
        OR (task_type = 'normal' AND target_count IS NULL)
    );

ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS chk_task_type_fields,
    DROP CONSTRAINT IF EXISTS tasks_task_type_check,
    DROP COLUMN IF EXISTS duration_seconds;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN ('normal', 'counter'));

ALTER TABLE tasks
    ADD CONSTRAINT chk_counter_needs_target CHECK (
        (task_type = 'counter' AND target_count IS NOT NULL AND target_count > 0)
        OR (task_type = 'normal' AND target_count IS NULL)
    );
