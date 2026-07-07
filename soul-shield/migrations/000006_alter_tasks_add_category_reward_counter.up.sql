-- +migrate Up
ALTER TABLE tasks
    ADD COLUMN category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    ADD COLUMN reward_text VARCHAR(255),
    ADD COLUMN task_type VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (task_type IN ('normal', 'counter')),
    ADD COLUMN target_count INT;

ALTER TABLE tasks
    ADD CONSTRAINT chk_counter_needs_target CHECK (
        (task_type = 'counter' AND target_count IS NOT NULL AND target_count > 0)
        OR (task_type = 'normal' AND target_count IS NULL)
    );

CREATE INDEX idx_tasks_category_id ON tasks(category_id);