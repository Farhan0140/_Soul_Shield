-- +migrate Down
ALTER TABLE task_completions DROP COLUMN IF EXISTS progress_count;