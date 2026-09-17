-- +migrate Up

-- task_completions/sub_task_completions never had updated_at (only
-- created_at) — added here because the sync protocol's last-write-wins
-- comparison and the mobile app's local-first cache both need it, and
-- because Increment (repo/task.go, repo/subtask.go) mutates progress_count
-- in place without ever touching created_at.
ALTER TABLE task_completions ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE task_completions ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE task_completions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE task_completions ADD CONSTRAINT uq_task_completions_uuid UNIQUE (uuid);

ALTER TABLE sub_task_completions ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE sub_task_completions ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE sub_task_completions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE sub_task_completions ADD CONSTRAINT uq_sub_task_completions_uuid UNIQUE (uuid);

CREATE INDEX idx_task_completions_deleted_at ON task_completions(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_sub_task_completions_deleted_at ON sub_task_completions(deleted_at) WHERE deleted_at IS NOT NULL;
