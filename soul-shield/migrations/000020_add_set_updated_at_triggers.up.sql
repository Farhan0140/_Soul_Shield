-- +migrate Up

-- Reusable trigger so every UPDATE stamps updated_at automatically — more
-- reliable than auditing each repo's UPDATE statements by hand (several
-- already set it inline; this makes it uniform and also covers the new
-- sync push handler without any extra code there).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_set_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categories_set_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sub_tasks_set_updated_at
    BEFORE UPDATE ON sub_tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_task_completions_set_updated_at
    BEFORE UPDATE ON task_completions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sub_task_completions_set_updated_at
    BEFORE UPDATE ON sub_task_completions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
