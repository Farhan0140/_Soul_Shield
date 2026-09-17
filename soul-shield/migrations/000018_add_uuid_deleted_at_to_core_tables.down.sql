-- +migrate Down
DROP INDEX IF EXISTS idx_sub_tasks_deleted_at;
DROP INDEX IF EXISTS idx_categories_deleted_at;
DROP INDEX IF EXISTS idx_tasks_deleted_at;

ALTER TABLE sub_tasks DROP CONSTRAINT IF EXISTS uq_sub_tasks_uuid;
ALTER TABLE sub_tasks DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE sub_tasks DROP COLUMN IF EXISTS uuid;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS uq_categories_uuid;
ALTER TABLE categories DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE categories DROP COLUMN IF EXISTS uuid;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS uq_tasks_uuid;
ALTER TABLE tasks DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS uuid;
