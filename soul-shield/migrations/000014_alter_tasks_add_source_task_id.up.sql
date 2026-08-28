-- +migrate Up
ALTER TABLE tasks ADD COLUMN source_task_id BIGINT NULL REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_source_task_id ON tasks(source_task_id);
