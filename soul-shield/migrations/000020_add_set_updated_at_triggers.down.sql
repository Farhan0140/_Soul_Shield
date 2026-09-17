-- +migrate Down
DROP TRIGGER IF EXISTS trg_sub_task_completions_set_updated_at ON sub_task_completions;
DROP TRIGGER IF EXISTS trg_task_completions_set_updated_at ON task_completions;
DROP TRIGGER IF EXISTS trg_sub_tasks_set_updated_at ON sub_tasks;
DROP TRIGGER IF EXISTS trg_categories_set_updated_at ON categories;
DROP TRIGGER IF EXISTS trg_tasks_set_updated_at ON tasks;

DROP FUNCTION IF EXISTS set_updated_at();
