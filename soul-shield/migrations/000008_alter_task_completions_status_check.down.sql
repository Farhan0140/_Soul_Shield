-- +migrate Down
ALTER TABLE task_completions
    DROP CONSTRAINT task_completions_status_check;

ALTER TABLE task_completions
    ADD CONSTRAINT task_completions_status_check
    CHECK (status IN ('completed', 'missed'));