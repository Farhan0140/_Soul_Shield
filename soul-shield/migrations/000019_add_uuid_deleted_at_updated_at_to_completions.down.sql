-- +migrate Down
DROP INDEX IF EXISTS idx_sub_task_completions_deleted_at;
DROP INDEX IF EXISTS idx_task_completions_deleted_at;

ALTER TABLE sub_task_completions DROP CONSTRAINT IF EXISTS uq_sub_task_completions_uuid;
ALTER TABLE sub_task_completions DROP COLUMN IF EXISTS updated_at;
ALTER TABLE sub_task_completions DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE sub_task_completions DROP COLUMN IF EXISTS uuid;

ALTER TABLE task_completions DROP CONSTRAINT IF EXISTS uq_task_completions_uuid;
ALTER TABLE task_completions DROP COLUMN IF EXISTS updated_at;
ALTER TABLE task_completions DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE task_completions DROP COLUMN IF EXISTS uuid;
