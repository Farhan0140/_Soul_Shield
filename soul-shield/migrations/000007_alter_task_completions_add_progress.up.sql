-- +migrate Up
ALTER TABLE task_completions
    ADD COLUMN progress_count INT NOT NULL DEFAULT 0;