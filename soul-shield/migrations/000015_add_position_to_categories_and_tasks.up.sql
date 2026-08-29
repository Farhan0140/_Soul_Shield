-- +migrate Up
ALTER TABLE categories ADD COLUMN position INT NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN position INT NOT NULL DEFAULT 0;

-- Backfill existing rows using their current implicit order (created_at, id)
-- so nothing visibly reshuffles for existing users the first time this ships.
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at, id) - 1 AS rn
    FROM categories
)
UPDATE categories c SET position = ranked.rn FROM ranked WHERE ranked.id = c.id;

WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id, category_id ORDER BY created_at, id) - 1 AS rn
    FROM tasks
)
UPDATE tasks t SET position = ranked.rn FROM ranked WHERE ranked.id = t.id;

CREATE INDEX idx_categories_owner_position ON categories(owner_id, position);
CREATE INDEX idx_tasks_owner_category_position ON tasks(owner_id, category_id, position);
