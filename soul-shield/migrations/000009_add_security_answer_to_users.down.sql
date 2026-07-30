-- +migrate Down
DROP TABLE IF EXISTS security_answer_attempt_logs;

ALTER TABLE users DROP COLUMN IF EXISTS security_answer_locked_until;
ALTER TABLE users DROP COLUMN IF EXISTS security_answer_attempts;
ALTER TABLE users DROP COLUMN IF EXISTS security_answer_hash;
