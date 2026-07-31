-- +migrate Up
CREATE TABLE IF NOT EXISTS sub_task_completions (
    id BIGSERIAL PRIMARY KEY,

    sub_task_id BIGINT REFERENCES sub_tasks(id) ON DELETE SET NULL,
    parent_task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    sub_task_title_snapshot VARCHAR(255) NOT NULL,

    task_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'missed')),
    progress_count INT NOT NULL DEFAULT 0,

    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_sub_task_completion UNIQUE (sub_task_id, user_id, task_date)
);

CREATE INDEX idx_sub_task_completions_user_date ON sub_task_completions(user_id, task_date);
CREATE INDEX idx_sub_task_completions_parent_date ON sub_task_completions(parent_task_id, user_id, task_date);
