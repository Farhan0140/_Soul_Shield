-- +migrate Up
CREATE TABLE IF NOT EXISTS sub_tasks (
    id BIGSERIAL PRIMARY KEY,

    parent_task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    task_type VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (task_type IN ('normal', 'counter')),
    target_count INT,
    position INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_subtask_counter_needs_target CHECK (
        (task_type = 'counter' AND target_count IS NOT NULL AND target_count > 0)
        OR (task_type = 'normal' AND target_count IS NULL)
    )
);

CREATE INDEX idx_sub_tasks_parent_task_id ON sub_tasks(parent_task_id);
