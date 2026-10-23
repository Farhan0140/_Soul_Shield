-- +migrate Up

-- Sub-task descriptions (optional). Mirrors tasks.description: free-form
-- TEXT with no CHECK constraints, unlike the length-capped title. Web edits
-- coming through PATCH /tasks never touch this column (its sub_tasks payload
-- has no description field), so an existing description survives a title-only
-- edit from that client; the mobile app manages descriptions through the
-- /sync push protocol, which assigns the column directly
-- (repo/sync_push.go's pushSubTask). Add every future change as a NEW
-- numbered file - never edit an already-applied migration.
ALTER TABLE sub_tasks ADD COLUMN description TEXT;

-- +migrate Down
ALTER TABLE sub_tasks DROP COLUMN description;
