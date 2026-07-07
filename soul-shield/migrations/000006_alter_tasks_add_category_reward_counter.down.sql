-- +migrate Down
ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS chk_counter_needs_target,
    DROP COLUMN IF EXISTS category_id,
    DROP COLUMN IF EXISTS reward_text,
    DROP COLUMN IF EXISTS task_type,
    DROP COLUMN IF EXISTS target_count;