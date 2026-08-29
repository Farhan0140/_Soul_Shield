-- +migrate Down
DROP INDEX IF EXISTS idx_tasks_owner_category_position;
DROP INDEX IF EXISTS idx_categories_owner_position;

ALTER TABLE tasks DROP COLUMN IF EXISTS position;
ALTER TABLE categories DROP COLUMN IF EXISTS position;
