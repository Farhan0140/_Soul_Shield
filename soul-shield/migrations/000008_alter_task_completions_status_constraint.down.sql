-- +migrate Down
-- +migrate StatementBegin
ALTER TABLE task_completions DROP CONSTRAINT IF EXISTS task_completions_status_check;
-- +migrate StatementEnd

-- +migrate StatementBegin
ALTER TABLE task_completions ADD CONSTRAINT task_completions_status_check CHECK (status IN ('completed', 'missed'));
-- +migrate StatementEnd