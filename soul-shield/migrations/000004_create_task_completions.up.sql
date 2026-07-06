-- +migrate Up
CREATE TABLE IF NOT EXISTS task_completions (
    id BIGSERIAL PRIMARY KEY,

    task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    task_title_snapshot VARCHAR(255) NOT NULL,
    was_global_snapshot BOOLEAN NOT NULL DEFAULT FALSE,

    task_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed'
        CHECK (status IN ('completed', 'missed')),

    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_task_completion UNIQUE (task_id, user_id, task_date)
);

CREATE INDEX idx_task_completions_user_date ON task_completions(user_id, task_date);
CREATE INDEX idx_task_completions_task_id ON task_completions(task_id);